"""
Migration 012: Adicionar organization_id e workspace_id em users

Permite escopos por organização/workspace para usuários.
Observação: sem FK para permitir tenant_id=0 (admin global).
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS organization_id INTEGER,
                ADD COLUMN IF NOT EXISTS workspace_id INTEGER;
            """))
            await db.commit()

            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_organization_id
                ON users (organization_id);
            """))
            await db.commit()

            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_workspace_id
                ON users (workspace_id);
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    """Reverte a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS workspace_id;"))
            await db.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS organization_id;"))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
