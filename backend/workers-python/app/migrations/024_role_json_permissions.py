"""
Migration 024: Converter role para JSONB (permissões)
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            # Criar coluna temporária JSONB
            await db.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS role_json JSONB;
            """))
            await db.commit()

            # Backfill com base no role atual
            await db.execute(text("""
                UPDATE users
                SET role_json = CASE
                    WHEN tenant_id = 0 THEN '[0]'::jsonb
                    WHEN role::text = 'admin' THEN '{"role":"admin"}'::jsonb
                    WHEN role::text = 'manager' THEN '{"role":"manager"}'::jsonb
                    WHEN role::text = 'viewer' THEN '{"role":"viewer"}'::jsonb
                    ELSE '{"role":"viewer"}'::jsonb
                END
                WHERE role_json IS NULL;
            """))
            await db.commit()

            # Default para novos usuários
            await db.execute(text("""
                ALTER TABLE users
                ALTER COLUMN role_json SET DEFAULT '{"role":"viewer"}'::jsonb;
            """))
            await db.commit()

            # Substituir coluna role
            await db.execute(text("""
                ALTER TABLE users
                DROP COLUMN IF EXISTS role;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE users
                RENAME COLUMN role_json TO role;
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    """Reverte a migration (mantém JSONB para evitar perda)."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("SELECT 1;"))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
