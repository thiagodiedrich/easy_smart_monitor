"""
Migration 030: Adicionar status em workspaces
"""
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_status') THEN
                        CREATE TYPE workspace_status AS ENUM ('active', 'inactive', 'blocked');
                    ELSE
                        ALTER TYPE workspace_status ADD VALUE IF NOT EXISTS 'active';
                        ALTER TYPE workspace_status ADD VALUE IF NOT EXISTS 'inactive';
                        ALTER TYPE workspace_status ADD VALUE IF NOT EXISTS 'blocked';
                    END IF;
                END$$;
            """))
            await db.commit()

            await db.execute(text("""
                ALTER TABLE workspaces
                ADD COLUMN IF NOT EXISTS status workspace_status NOT NULL DEFAULT 'active';
            """))
            await db.commit()

            await db.execute(text("""
                UPDATE workspaces
                SET status = 'active'
                WHERE status IS NULL;
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
                DROP COLUMN IF EXISTS status;
            """))
            await db.execute(text("DROP TYPE IF EXISTS workspace_status;"))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
