"""
Migration 031: Adicionar description em workspaces
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                ALTER TABLE workspaces
                ADD COLUMN IF NOT EXISTS description VARCHAR(255);
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
                ALTER TABLE workspaces
                DROP COLUMN IF EXISTS description;
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
