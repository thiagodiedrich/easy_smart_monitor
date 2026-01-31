"""
Migration 013: Tabela de uso diário por tenant/organização/workspace

Fase 7:
- Cria tenant_usage_daily_scoped para métricas por org/workspace.
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_usage_daily_scoped (
                    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    organization_id INTEGER NOT NULL DEFAULT 0,
                    workspace_id INTEGER NOT NULL DEFAULT 0,
                    day DATE NOT NULL,
                    items_count BIGINT NOT NULL DEFAULT 0,
                    sensors_count BIGINT NOT NULL DEFAULT 0,
                    bytes_ingested BIGINT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (tenant_id, organization_id, workspace_id, day)
                );
            """))
            await db.commit()

            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_usage_scoped_tenant_org
                ON tenant_usage_daily_scoped (tenant_id, organization_id, day);
            """))
            await db.commit()

            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_usage_scoped_tenant_workspace
                ON tenant_usage_daily_scoped (tenant_id, workspace_id, day);
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    """Reverte a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("DROP TABLE IF EXISTS tenant_usage_daily_scoped;"))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
