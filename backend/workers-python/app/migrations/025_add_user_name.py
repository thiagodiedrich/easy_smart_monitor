"""
Migration 025: Adicionar campo name em users
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS name VARCHAR(150);
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def downgrade():
    """Reverte a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS name;"))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
