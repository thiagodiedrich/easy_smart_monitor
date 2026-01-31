"""
Migration 018: Refatorar plans e tenant_limits

Requisitos:
- plans.status ENUM(active,inactive) NOT NULL
- itens/sensores/bytes NOT NULL DEFAULT 0
- totals: equipments_total, sensors_total, users_total, organization_total, workspace_total
- collection_interval BIGINT NOT NULL DEFAULT 60
- alert_delay_seconds NOT NULL DEFAULT 1
- tenant_limits com os mesmos campos e defaults
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    async with AsyncSessionLocal() as db:
        try:
            # Enum status
            await db.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE plan_status AS ENUM ('active', 'inactive');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))

            # Plans
            await db.execute(text("""
                ALTER TABLE plans
                ADD COLUMN IF NOT EXISTS status plan_status NOT NULL DEFAULT 'active';
            """))
            await db.commit()

            await db.execute(text("""
                UPDATE plans
                SET items_per_day = COALESCE(items_per_day, 0),
                    sensors_per_day = COALESCE(sensors_per_day, 0),
                    bytes_per_day = COALESCE(bytes_per_day, 0),
                    alert_delay_seconds = COALESCE(alert_delay_seconds, 1);
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE plans
                ALTER COLUMN items_per_day SET DEFAULT 0,
                ALTER COLUMN items_per_day SET NOT NULL,
                ALTER COLUMN sensors_per_day SET DEFAULT 0,
                ALTER COLUMN sensors_per_day SET NOT NULL,
                ALTER COLUMN bytes_per_day SET DEFAULT 0,
                ALTER COLUMN bytes_per_day SET NOT NULL,
                ALTER COLUMN alert_delay_seconds SET DEFAULT 1,
                ALTER COLUMN alert_delay_seconds SET NOT NULL;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE plans
                ADD COLUMN IF NOT EXISTS equipments_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS sensors_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS users_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS organization_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS workspace_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS collection_interval BIGINT NOT NULL DEFAULT 60;
            """))
            await db.commit()

            # Tenant limits
            await db.execute(text("""
                UPDATE tenant_limits
                SET items_per_day = COALESCE(items_per_day, 0),
                    sensors_per_day = COALESCE(sensors_per_day, 0),
                    bytes_per_day = COALESCE(bytes_per_day, 0),
                    alert_delay_seconds = COALESCE(alert_delay_seconds, 1);
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE tenant_limits
                ALTER COLUMN items_per_day SET DEFAULT 0,
                ALTER COLUMN items_per_day SET NOT NULL,
                ALTER COLUMN sensors_per_day SET DEFAULT 0,
                ALTER COLUMN sensors_per_day SET NOT NULL,
                ALTER COLUMN bytes_per_day SET DEFAULT 0,
                ALTER COLUMN bytes_per_day SET NOT NULL,
                ALTER COLUMN alert_delay_seconds SET DEFAULT 1,
                ALTER COLUMN alert_delay_seconds SET NOT NULL;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE tenant_limits
                ADD COLUMN IF NOT EXISTS equipments_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS sensors_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS users_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS organization_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS workspace_total BIGINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS collection_interval BIGINT NOT NULL DEFAULT 60;
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                ALTER TABLE tenant_limits
                DROP COLUMN IF EXISTS collection_interval,
                DROP COLUMN IF EXISTS workspace_total,
                DROP COLUMN IF EXISTS organization_total,
                DROP COLUMN IF EXISTS users_total,
                DROP COLUMN IF EXISTS sensors_total,
                DROP COLUMN IF EXISTS equipments_total;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE plans
                DROP COLUMN IF EXISTS collection_interval,
                DROP COLUMN IF EXISTS workspace_total,
                DROP COLUMN IF EXISTS organization_total,
                DROP COLUMN IF EXISTS users_total,
                DROP COLUMN IF EXISTS sensors_total,
                DROP COLUMN IF EXISTS equipments_total,
                DROP COLUMN IF EXISTS status;
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
