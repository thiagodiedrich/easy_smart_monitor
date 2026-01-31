"""
Migration 026: Adicionar documento/telefone/email em organizations
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                ALTER TABLE organizations
                ADD COLUMN IF NOT EXISTS document VARCHAR(50),
                ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
                ADD COLUMN IF NOT EXISTS email VARCHAR(120);
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
                ALTER TABLE organizations
                DROP COLUMN IF EXISTS document,
                DROP COLUMN IF EXISTS phone,
                DROP COLUMN IF EXISTS email;
            """))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
