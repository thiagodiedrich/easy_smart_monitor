"""
Worker de alertas (Fase 7).

- Processa regras globais (tenant_id=0) e específicas por tenant.
- Gera alertas por thresholds 80/90/100.
- Dispara webhooks com retry simples.
"""
import asyncio
import hmac
import json
import time
from hashlib import sha256
from typing import List, Dict, Any, Optional

import httpx
import structlog
from sqlalchemy import text

from app.core.config import settings
from app.core.database import AsyncSessionLocal


logger = structlog.get_logger(__name__)


def _now_ts() -> int:
    return int(time.time())


def _event_type_from_alert(alert_type: str) -> str:
    # quota_items_80 -> quota_80
    parts = alert_type.split("_")
    if len(parts) >= 3:
        return f"{parts[0]}_{parts[-1]}"
    return alert_type


def _should_match_workspace(rule_or_hook_ws: List[int], workspace_id: int) -> bool:
    if not rule_or_hook_ws:
        return True
    if 0 in rule_or_hook_ws:
        return True
    return workspace_id in rule_or_hook_ws


async def _fetch_tenants(db) -> List[Dict[str, Any]]:
    result = await db.execute(text("""
        SELECT
            t.id,
            COALESCE(tl.alert_delay_seconds, p.alert_delay_seconds, :default_delay) AS alert_delay_seconds,
            COALESCE(tl.items_per_day, p.items_per_day) AS items_per_day,
            COALESCE(tl.sensors_per_day, p.sensors_per_day) AS sensors_per_day,
            COALESCE(tl.bytes_per_day, p.bytes_per_day) AS bytes_per_day
        FROM tenants t
        LEFT JOIN plans p ON p.code = t.plan_code
        LEFT JOIN tenant_limits tl ON tl.tenant_id = t.id
        WHERE t.status = 'active' OR t.id = 0
    """), {"default_delay": settings.ALERT_POLL_SECONDS})
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


async def _get_last_checked(db, tenant_id: int) -> Optional[int]:
    result = await db.execute(text("""
        SELECT EXTRACT(EPOCH FROM last_checked_at)::BIGINT AS last_checked
        FROM tenant_alert_state WHERE tenant_id = :tenant_id
    """), {"tenant_id": tenant_id})
    row = result.fetchone()
    return int(row[0]) if row and row[0] is not None else None


async def _update_last_checked(db, tenant_id: int) -> None:
    await db.execute(text("""
        INSERT INTO tenant_alert_state (tenant_id, last_checked_at)
        VALUES (:tenant_id, NOW())
        ON CONFLICT (tenant_id) DO UPDATE
        SET last_checked_at = NOW();
    """), {"tenant_id": tenant_id})
    await db.commit()


async def _fetch_rules(db, tenant_id: int) -> List[Dict[str, Any]]:
    result = await db.execute(text("""
        SELECT id, tenant_id, organization_id, workspace_ids, threshold_percent, enabled
        FROM tenant_alert_rules
        WHERE tenant_id IN (0, :tenant_id) AND enabled = TRUE
    """), {"tenant_id": tenant_id})
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


async def _fetch_webhooks(db, tenant_id: int) -> List[Dict[str, Any]]:
    result = await db.execute(text("""
        SELECT id, tenant_id, organization_id, workspace_ids, event_types, url, secret, enabled
        FROM tenant_webhooks
        WHERE tenant_id IN (0, :tenant_id) AND enabled = TRUE
    """), {"tenant_id": tenant_id})
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


async def _get_usage(
    db,
    tenant_id: int,
    organization_id: int,
    workspace_ids: List[int],
) -> Dict[str, int]:
    # Global (tenant) -> tabela tenant_usage_daily
    if organization_id == 0 and (0 in workspace_ids):
        result = await db.execute(text("""
            SELECT items_count, sensors_count, bytes_ingested
            FROM tenant_usage_daily
            WHERE tenant_id = :tenant_id AND day = CURRENT_DATE
        """), {"tenant_id": tenant_id})
        row = result.fetchone()
        if not row:
            return {"items_count": 0, "sensors_count": 0, "bytes_ingested": 0}
        return {
            "items_count": int(row[0] or 0),
            "sensors_count": int(row[1] or 0),
            "bytes_ingested": int(row[2] or 0),
        }

    # Scoped (org/workspace)
    params = {"tenant_id": tenant_id}
    where = "tenant_id = :tenant_id AND day = CURRENT_DATE"
    if organization_id != 0:
        where += " AND organization_id = :org_id"
        params["org_id"] = organization_id
    if 0 not in workspace_ids:
        where += " AND workspace_id = ANY(:workspace_ids)"
        params["workspace_ids"] = workspace_ids

    result = await db.execute(text(f"""
        SELECT
            COALESCE(SUM(items_count), 0) AS items_count,
            COALESCE(SUM(sensors_count), 0) AS sensors_count,
            COALESCE(SUM(bytes_ingested), 0) AS bytes_ingested
        FROM tenant_usage_daily_scoped
        WHERE {where}
    """), params)
    row = result.fetchone()
    return {
        "items_count": int(row[0] or 0),
        "sensors_count": int(row[1] or 0),
        "bytes_ingested": int(row[2] or 0),
    }


async def _create_alert(
    db,
    tenant_id: int,
    organization_id: int,
    workspace_id: int,
    alert_type: str,
    message: str,
    metadata: Dict[str, Any],
) -> Optional[int]:
    result = await db.execute(text("""
        INSERT INTO tenant_alerts (
            tenant_id, organization_id, workspace_id, alert_type, day, message, metadata
        ) VALUES (:tenant_id, :org_id, :ws_id, :alert_type, CURRENT_DATE, :message, :metadata)
        ON CONFLICT DO NOTHING
        RETURNING id;
    """), {
        "tenant_id": tenant_id,
        "org_id": organization_id,
        "ws_id": workspace_id,
        "alert_type": alert_type,
        "message": message,
        "metadata": json.dumps(metadata),
    })
    row = result.fetchone()
    await db.commit()
    return int(row[0]) if row else None


async def _send_webhook(client, webhook: Dict[str, Any], payload: Dict[str, Any]) -> bool:
    if not webhook.get("url"):
        return False
    headers = {"content-type": "application/json"}
    secret = webhook.get("secret")
    if secret:
        signature = hmac.new(secret.encode(), json.dumps(payload).encode(), sha256).hexdigest()
        headers["x-signature"] = signature
    resp = await client.post(webhook["url"], json=payload, headers=headers, timeout=10)
    return resp.status_code >= 200 and resp.status_code < 300


async def _deliver_alerts(db, alert_id: int, alert_type: str, tenant_id: int, organization_id: int, workspace_id: int):
    if not settings.WEBHOOKS_ENABLED:
        return
    webhooks = await _fetch_webhooks(db, tenant_id)
    event_type = _event_type_from_alert(alert_type)
    payload = {
        "event": event_type,
        "alert_type": alert_type,
        "tenant_id": tenant_id,
        "organization_id": organization_id,
        "workspace_id": workspace_id,
        "timestamp": int(time.time()),
    }
    async with httpx.AsyncClient() as client:
        for webhook in webhooks:
            ws_ids = webhook.get("workspace_ids") or []
            if webhook["organization_id"] not in (0, organization_id) and webhook["organization_id"] != organization_id:
                continue
            if not _should_match_workspace(ws_ids, workspace_id):
                continue
            event_types = webhook.get("event_types") or []
            if event_types and event_type not in event_types:
                continue

            # registrar delivery pending
            result = await db.execute(text("""
                INSERT INTO tenant_alert_delivery (alert_id, webhook_id, status, attempts)
                VALUES (:alert_id, :webhook_id, 'pending', 0)
                RETURNING id;
            """), {"alert_id": alert_id, "webhook_id": webhook["id"]})
            delivery_id = int(result.fetchone()[0])
            await db.commit()

            try:
                ok = await _send_webhook(client, webhook, payload)
                if ok:
                    await db.execute(text("""
                        UPDATE tenant_alert_delivery
                        SET status = 'sent', attempts = attempts + 1, updated_at = NOW()
                        WHERE id = :id
                    """), {"id": delivery_id})
                else:
                    await db.execute(text("""
                        UPDATE tenant_alert_delivery
                        SET status = 'failed', attempts = attempts + 1, updated_at = NOW()
                        WHERE id = :id
                    """), {"id": delivery_id})
                await db.commit()
            except Exception as exc:
                await db.execute(text("""
                    UPDATE tenant_alert_delivery
                    SET status = 'failed', attempts = attempts + 1, last_error = :err, updated_at = NOW()
                    WHERE id = :id
                """), {"id": delivery_id, "err": str(exc)})
                await db.commit()


async def _process_tenant(db, tenant: Dict[str, Any]) -> None:
    tenant_id = int(tenant["id"])
    delay = int(tenant.get("alert_delay_seconds") or settings.ALERT_POLL_SECONDS)
    last_checked = await _get_last_checked(db, tenant_id)
    if last_checked and (_now_ts() - last_checked) < delay:
        return

    rules = await _fetch_rules(db, tenant_id)
    if not rules:
        await _update_last_checked(db, tenant_id)
        return

    limits = {
        "items": tenant.get("items_per_day"),
        "sensors": tenant.get("sensors_per_day"),
        "bytes": tenant.get("bytes_per_day"),
    }

    for rule in rules:
        org_id = int(rule["organization_id"] or 0)
        ws_ids = rule.get("workspace_ids") or [0]
        threshold = int(rule["threshold_percent"])
        usage = await _get_usage(db, tenant_id, org_id, ws_ids)

        for metric, limit in limits.items():
            if not limit or int(limit) <= 0:
                continue
            used = int(usage.get(f"{metric}_count") if metric != "bytes" else usage.get("bytes_ingested"))
            percent = (used / int(limit)) * 100 if limit else 0
            if percent >= threshold:
                alert_type = f"quota_{metric}_{threshold}"
                message = f"Uso de {metric} atingiu {threshold}%"
                alert_id = await _create_alert(
                    db,
                    tenant_id,
                    org_id,
                    0 if 0 in ws_ids else ws_ids[0],
                    alert_type,
                    message,
                    {
                        "used": used,
                        "limit": int(limit),
                        "percent": round(percent, 2),
                        "organization_id": org_id,
                        "workspace_ids": ws_ids,
                    },
                )
                if alert_id:
                    await _deliver_alerts(db, alert_id, alert_type, tenant_id, org_id, 0 if 0 in ws_ids else ws_ids[0])

    await _update_last_checked(db, tenant_id)


async def run_alerts_loop():
    if not settings.ALERTS_ENABLED:
        logger.info("Alert worker desabilitado")
        return

    logger.info("Alert worker iniciado", poll_seconds=settings.ALERT_POLL_SECONDS)
    while True:
        try:
            async with AsyncSessionLocal() as db:
                tenants = await _fetch_tenants(db)
                for tenant in tenants:
                    await _process_tenant(db, tenant)
        except Exception as exc:
            logger.error("Erro no worker de alertas", error=str(exc))

        await asyncio.sleep(settings.ALERT_POLL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run_alerts_loop())
