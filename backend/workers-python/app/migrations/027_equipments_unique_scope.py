"""
Migration 027: Unicidade de equipments por uuid + tenant/org/workspace
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'equipments_uuid_key'
                    ) THEN
                        ALTER TABLE equipments DROP CONSTRAINT equipments_uuid_key;
                    END IF;
                END $$;
            """))
            await db.commit()

            await db.execute(text("""
                WITH ranked AS (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY uuid, tenant_id, organization_id, workspace_id
                               ORDER BY id
                           ) AS rn
                    FROM equipments
                )
                DELETE FROM equipments
                WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE equipments
                ADD CONSTRAINT equipments_uuid_tenant_org_ws_key
                UNIQUE (uuid, tenant_id, organization_id, workspace_id);
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    """Reverte a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                ALTER TABLE equipments
                DROP CONSTRAINT IF EXISTS equipments_uuid_tenant_org_ws_key;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE equipments
                ADD CONSTRAINT equipments_uuid_key UNIQUE (uuid);
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
