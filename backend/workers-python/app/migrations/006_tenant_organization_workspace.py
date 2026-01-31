"""
Migration 006: Criar tabelas SaaS base (tenants, organizations, workspaces)

Fase 0 da evolução multi-tenant:
- Cria as tabelas de identidade SaaS sem afetar as entidades existentes.
- Não altera dados atuais nem exige tenant_id nas tabelas de telemetria.
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            # 1. Tabela tenants
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS tenants (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(150) NOT NULL,
                    slug VARCHAR(100) UNIQUE NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    plan_code VARCHAR(50),
                    is_white_label BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            """))
            await db.commit()

            # 2. Tabela organizations
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS organizations (
                    id SERIAL PRIMARY KEY,
                    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    name VARCHAR(150) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            """))
            await db.commit()

            # 3. Tabela workspaces
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS workspaces (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                    name VARCHAR(150) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            """))
            await db.commit()

            # 4. Índices auxiliares
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_organizations_tenant_id
                ON organizations (tenant_id);
            """))
            await db.commit()

            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_workspaces_organization_id
                ON workspaces (organization_id);
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    """Reverte a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("DROP TABLE IF EXISTS workspaces;"))
            await db.execute(text("DROP TABLE IF EXISTS organizations;"))
            await db.execute(text("DROP TABLE IF EXISTS tenants;"))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
