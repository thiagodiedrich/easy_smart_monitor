"""
Migration 032: Garantir coluna name em users e backfill
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

            await db.execute(text("""
                UPDATE users
                SET name = COALESCE(name, username)
                WHERE name IS NULL;
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
                DROP COLUMN IF EXISTS name;
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
