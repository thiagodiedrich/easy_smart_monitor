"""
Migration 017: Refatorar equipments, sensors e telemetry_data

Requisitos:
- equipments: remove location e user_id; status enum active/inactive/blocked; tenant/org/workspace NOT NULL
- sensors: status enum active/inactive/blocked; tenant/org/workspace NOT NULL
- telemetry_data: tenant/org/workspace NOT NULL
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


def _map_status(value: str) -> str:
    if not value:
        return "active"
    normalized = value.strip().lower()
    if normalized in ("ativo", "active"):
        return "active"
    if normalized in ("inativo", "inactive"):
        return "inactive"
    if normalized in ("bloqueado", "blocked"):
        return "blocked"
    return "active"


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            # Enum de status para entidades
            await db.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE entity_status AS ENUM ('active', 'inactive', 'blocked');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            await db.commit()

            # Garantir tenant/org/workspace 0 (fallback)
            await db.execute(text("""
                INSERT INTO tenants (id, name, slug, status)
                VALUES (0, 'System', 'system', 'active')
                ON CONFLICT DO NOTHING;
            """))
            await db.commit()
            await db.execute(text("""
                INSERT INTO organizations (id, tenant_id, name)
                VALUES (0, 0, 'System Org')
                ON CONFLICT DO NOTHING;
            """))
            await db.commit()
            await db.execute(text("""
                INSERT INTO workspaces (id, organization_id, name)
                VALUES (0, 0, 'System Workspace')
                ON CONFLICT DO NOTHING;
            """))
            await db.commit()

            # Equipments: garantir tenant/org/workspace (backfill)
            await db.execute(text("""
                UPDATE equipments
                SET organization_id = 0
                WHERE organization_id IS NULL;
            """))
            await db.execute(text("""
                UPDATE equipments
                SET workspace_id = 0
                WHERE workspace_id IS NULL;
            """))
            await db.commit()

            # Equipments: status enum e remover location/user_id
            await db.execute(text("""
                ALTER TABLE equipments
                ALTER COLUMN status TYPE entity_status
                USING
                    CASE
                        WHEN lower(status) IN ('ativo','active') THEN 'active'::entity_status
                        WHEN lower(status) IN ('inativo','inactive') THEN 'inactive'::entity_status
                        WHEN lower(status) IN ('bloqueado','blocked') THEN 'blocked'::entity_status
                        ELSE 'active'::entity_status
                    END;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE equipments
                ALTER COLUMN tenant_id SET NOT NULL,
                ALTER COLUMN organization_id SET NOT NULL,
                ALTER COLUMN workspace_id SET NOT NULL;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE equipments
                ALTER COLUMN status SET DEFAULT 'active';
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE equipments
                DROP COLUMN IF EXISTS location,
                DROP COLUMN IF EXISTS user_id;
            """))
            await db.commit()

            # Sensors: adicionar tenant/org/workspace e status enum
            await db.execute(text("""
                ALTER TABLE sensors
                ADD COLUMN IF NOT EXISTS tenant_id INTEGER,
                ADD COLUMN IF NOT EXISTS organization_id INTEGER,
                ADD COLUMN IF NOT EXISTS workspace_id INTEGER;
            """))
            await db.commit()

            await db.execute(text("""
                UPDATE sensors s
                SET tenant_id = e.tenant_id,
                    organization_id = e.organization_id,
                    workspace_id = e.workspace_id
                FROM equipments e
                WHERE s.equipment_id = e.id
                  AND (s.tenant_id IS NULL OR s.organization_id IS NULL OR s.workspace_id IS NULL);
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE sensors
                ALTER COLUMN status TYPE entity_status
                USING
                    CASE
                        WHEN lower(status) IN ('ativo','active') THEN 'active'::entity_status
                        WHEN lower(status) IN ('inativo','inactive') THEN 'inactive'::entity_status
                        WHEN lower(status) IN ('bloqueado','blocked') THEN 'blocked'::entity_status
                        ELSE 'active'::entity_status
                    END;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE sensors
                ALTER COLUMN tenant_id SET NOT NULL,
                ALTER COLUMN organization_id SET NOT NULL,
                ALTER COLUMN workspace_id SET NOT NULL;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE sensors
                ALTER COLUMN status SET DEFAULT 'active';
            """))
            await db.commit()

            # FKs para sensors
            await db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'sensors_tenant_id_fkey'
                    ) THEN
                        ALTER TABLE sensors
                        ADD CONSTRAINT sensors_tenant_id_fkey
                        FOREIGN KEY (tenant_id) REFERENCES tenants(id);
                    END IF;
                END $$;
            """))
            await db.commit()
            await db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'sensors_organization_id_fkey'
                    ) THEN
                        ALTER TABLE sensors
                        ADD CONSTRAINT sensors_organization_id_fkey
                        FOREIGN KEY (organization_id) REFERENCES organizations(id);
                    END IF;
                END $$;
            """))
            await db.commit()
            await db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'sensors_workspace_id_fkey'
                    ) THEN
                        ALTER TABLE sensors
                        ADD CONSTRAINT sensors_workspace_id_fkey
                        FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
                    END IF;
                END $$;
            """))
            await db.commit()

            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sensors_tenant_id
                ON sensors (tenant_id);
            """))
            await db.commit()
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sensors_organization_id
                ON sensors (organization_id);
            """))
            await db.commit()
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sensors_workspace_id
                ON sensors (workspace_id);
            """))
            await db.commit()

            # Telemetry_data: adicionar tenant/org/workspace
            await db.execute(text("""
                ALTER TABLE telemetry_data
                ADD COLUMN IF NOT EXISTS tenant_id INTEGER,
                ADD COLUMN IF NOT EXISTS organization_id INTEGER,
                ADD COLUMN IF NOT EXISTS workspace_id INTEGER;
            """))
            await db.commit()

            await db.execute(text("""
                UPDATE telemetry_data td
                SET tenant_id = e.tenant_id,
                    organization_id = e.organization_id,
                    workspace_id = e.workspace_id
                FROM equipments e
                WHERE td.equipment_id = e.id
                  AND (td.tenant_id IS NULL OR td.organization_id IS NULL OR td.workspace_id IS NULL);
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE telemetry_data
                ALTER COLUMN tenant_id SET NOT NULL,
                ALTER COLUMN organization_id SET NOT NULL,
                ALTER COLUMN workspace_id SET NOT NULL;
            """))
            await db.commit()

            # FKs para telemetry_data
            await db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'telemetry_tenant_id_fkey'
                    ) THEN
                        ALTER TABLE telemetry_data
                        ADD CONSTRAINT telemetry_tenant_id_fkey
                        FOREIGN KEY (tenant_id) REFERENCES tenants(id);
                    END IF;
                END $$;
            """))
            await db.commit()
            await db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'telemetry_organization_id_fkey'
                    ) THEN
                        ALTER TABLE telemetry_data
                        ADD CONSTRAINT telemetry_organization_id_fkey
                        FOREIGN KEY (organization_id) REFERENCES organizations(id);
                    END IF;
                END $$;
            """))
            await db.commit()
            await db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'telemetry_workspace_id_fkey'
                    ) THEN
                        ALTER TABLE telemetry_data
                        ADD CONSTRAINT telemetry_workspace_id_fkey
                        FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
                    END IF;
                END $$;
            """))
            await db.commit()

            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_telemetry_tenant_timestamp
                ON telemetry_data (tenant_id, timestamp DESC);
            """))
            await db.commit()
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_telemetry_org_timestamp
                ON telemetry_data (organization_id, timestamp DESC);
            """))
            await db.commit()
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_telemetry_workspace_timestamp
                ON telemetry_data (workspace_id, timestamp DESC);
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
                ALTER TABLE telemetry_data
                DROP COLUMN IF EXISTS workspace_id,
                DROP COLUMN IF EXISTS organization_id,
                DROP COLUMN IF EXISTS tenant_id;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE sensors
                DROP COLUMN IF EXISTS workspace_id,
                DROP COLUMN IF EXISTS organization_id,
                DROP COLUMN IF EXISTS tenant_id;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE equipments
                ADD COLUMN IF NOT EXISTS location VARCHAR(200),
                ADD COLUMN IF NOT EXISTS user_id INTEGER;
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
