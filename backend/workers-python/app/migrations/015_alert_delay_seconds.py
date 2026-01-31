"""
Migration 015: Alert delay por plano e por tenant
"""
import os
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


DEFAULT_PLAN_ALERT_DELAY_SECONDS = os.getenv("DEFAULT_PLAN_ALERT_DELAY_SECONDS")


def _to_int(value):
    try:
        return int(value) if value is not None and str(value).isdigit() else None
    except Exception:
        return None


async def upgrade():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                ALTER TABLE plans
                ADD COLUMN IF NOT EXISTS alert_delay_seconds INTEGER;
            """))
            await db.execute(text("""
                ALTER TABLE tenant_limits
                ADD COLUMN IF NOT EXISTS alert_delay_seconds INTEGER;
            """))
            await db.commit()

            if DEFAULT_PLAN_ALERT_DELAY_SECONDS:
                await db.execute(text("""
                    UPDATE plans
                    SET alert_delay_seconds = COALESCE(alert_delay_seconds, :delay)
                """), {"delay": _to_int(DEFAULT_PLAN_ALERT_DELAY_SECONDS)})
                await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("ALTER TABLE tenant_limits DROP COLUMN IF EXISTS alert_delay_seconds;"))
            await db.execute(text("ALTER TABLE plans DROP COLUMN IF EXISTS alert_delay_seconds;"))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
