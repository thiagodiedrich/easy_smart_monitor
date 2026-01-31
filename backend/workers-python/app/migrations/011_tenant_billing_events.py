"""
Migration 011: Eventos de billing por tenant

Fase 6:
- Registra eventos relevantes (ex.: quota excedida, alertas).
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_billing_events (
                    id SERIAL PRIMARY KEY,
                    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    event_type VARCHAR(50) NOT NULL,
                    message TEXT,
                    metadata JSONB,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            """))
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_tenant_billing_events_tenant_id
                ON tenant_billing_events (tenant_id);
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    """Reverte a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("DROP TABLE IF EXISTS tenant_billing_events;"))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
