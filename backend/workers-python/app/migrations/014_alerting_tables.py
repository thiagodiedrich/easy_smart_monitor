"""
Migration 014: Tabelas de alertas e webhooks (Fase 7)

- tenant_alert_rules
- tenant_alerts
- tenant_webhooks
- tenant_alert_delivery
- tenant_alert_state
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_alert_rules (
                    id SERIAL PRIMARY KEY,
                    tenant_id INTEGER NOT NULL,
                    organization_id INTEGER NOT NULL DEFAULT 0,
                    workspace_ids INTEGER[] NOT NULL DEFAULT '{0}',
                    threshold_percent INTEGER NOT NULL,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            """))
            await db.commit()

            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_alerts (
                    id SERIAL PRIMARY KEY,
                    tenant_id INTEGER NOT NULL,
                    organization_id INTEGER NOT NULL DEFAULT 0,
                    workspace_id INTEGER NOT NULL DEFAULT 0,
                    alert_type VARCHAR(50) NOT NULL,
                    day DATE NOT NULL,
                    message TEXT,
                    metadata JSONB,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    resolved_at TIMESTAMP NULL
                );
            """))
            await db.commit()

            await db.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_alerts_day
                ON tenant_alerts (tenant_id, organization_id, workspace_id, alert_type, day);
            """))
            await db.commit()

            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_webhooks (
                    id SERIAL PRIMARY KEY,
                    tenant_id INTEGER NOT NULL,
                    organization_id INTEGER NOT NULL DEFAULT 0,
                    workspace_ids INTEGER[] NOT NULL DEFAULT '{0}',
                    event_types TEXT[] NOT NULL DEFAULT '{quota_80,quota_90,quota_100}',
                    url TEXT,
                    secret TEXT,
                    enabled BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            """))
            await db.commit()

            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_alert_delivery (
                    id SERIAL PRIMARY KEY,
                    alert_id INTEGER NOT NULL REFERENCES tenant_alerts(id) ON DELETE CASCADE,
                    webhook_id INTEGER NOT NULL REFERENCES tenant_webhooks(id) ON DELETE CASCADE,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    next_retry_at TIMESTAMP NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            """))
            await db.commit()

            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_alert_state (
                    tenant_id INTEGER PRIMARY KEY,
                    last_checked_at TIMESTAMP NULL
                );
            """))
            await db.commit()

            # Regras globais (tenant_id=0) 80/90/100
            await db.execute(text("""
                INSERT INTO tenant_alert_rules (tenant_id, organization_id, workspace_ids, threshold_percent)
                VALUES
                    (0, 0, '{0}', 80),
                    (0, 0, '{0}', 90),
                    (0, 0, '{0}', 100)
                ON CONFLICT DO NOTHING;
            """))
            await db.commit()

            # Webhook global (desativado por padrão)
            await db.execute(text("""
                INSERT INTO tenant_webhooks (tenant_id, organization_id, workspace_ids, enabled)
                VALUES (0, 0, '{0}', FALSE)
                ON CONFLICT DO NOTHING;
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    """Reverte a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("DROP TABLE IF EXISTS tenant_alert_delivery;"))
            await db.execute(text("DROP TABLE IF EXISTS tenant_webhooks;"))
            await db.execute(text("DROP TABLE IF EXISTS tenant_alerts;"))
            await db.execute(text("DROP TABLE IF EXISTS tenant_alert_rules;"))
            await db.execute(text("DROP TABLE IF EXISTS tenant_alert_state;"))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
