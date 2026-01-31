"""
Migration 016: Refatorar users (tenant obrigatório, roles, arrays org/workspace)

Requisitos:
- tenant_id NOT NULL
- organization_id e workspace_id como arrays (0 = acesso total)
- remover is_active e is_superuser (redundantes)
- adicionar role (nível de acesso)
- salvar hash de refresh token e expiração
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            # Garantir tenant sistema (id=0)
            await db.execute(text("""
                INSERT INTO tenants (id, name, slug, status)
                VALUES (0, 'System', 'system', 'active')
                ON CONFLICT DO NOTHING;
            """))
            await db.commit()

            # Role enum
            await db.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE userrole AS ENUM ('admin', 'manager', 'viewer');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))

            # Ajustar tenant_id: garantir preenchido e NOT NULL
            await db.execute(text("""
                UPDATE users
                SET tenant_id = 0
                WHERE tenant_id IS NULL;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE users
                ALTER COLUMN tenant_id SET NOT NULL;
            """))
            await db.commit()

            # Converter organization_id/workspace_id para arrays e default {0}
            await db.execute(text("""
                UPDATE users
                SET organization_id = 0
                WHERE organization_id IS NULL;
            """))
            await db.execute(text("""
                UPDATE users
                SET workspace_id = 0
                WHERE workspace_id IS NULL;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE users
                ALTER COLUMN organization_id TYPE INTEGER[] USING ARRAY[organization_id],
                ALTER COLUMN workspace_id TYPE INTEGER[] USING ARRAY[workspace_id];
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE users
                ALTER COLUMN organization_id SET DEFAULT '{0}',
                ALTER COLUMN organization_id SET NOT NULL,
                ALTER COLUMN workspace_id SET DEFAULT '{0}',
                ALTER COLUMN workspace_id SET NOT NULL;
            """))
            await db.commit()

            # Adicionar role e campos de refresh token
            await db.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS role userrole NOT NULL DEFAULT 'viewer',
                ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255),
                ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP;
            """))
            await db.commit()

            # Remover colunas redundantes
            await db.execute(text("""
                ALTER TABLE users
                DROP COLUMN IF EXISTS is_active,
                DROP COLUMN IF EXISTS is_superuser;
            """))
            await db.commit()

            # Índices para arrays (GIN)
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_organization_id_gin
                ON users USING GIN (organization_id);
            """))
            await db.commit()

            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_workspace_id_gin
                ON users USING GIN (workspace_id);
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
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL,
                ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN DEFAULT FALSE NOT NULL;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE users
                DROP COLUMN IF EXISTS refresh_token_hash,
                DROP COLUMN IF EXISTS refresh_token_expires_at,
                DROP COLUMN IF EXISTS role;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE users
                ALTER COLUMN organization_id TYPE INTEGER USING organization_id[1],
                ALTER COLUMN workspace_id TYPE INTEGER USING workspace_id[1];
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE users
                ALTER COLUMN organization_id DROP DEFAULT,
                ALTER COLUMN organization_id DROP NOT NULL,
                ALTER COLUMN workspace_id DROP DEFAULT,
                ALTER COLUMN workspace_id DROP NOT NULL;
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
