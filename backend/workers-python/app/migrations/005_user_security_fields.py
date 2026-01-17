"""
Migration 005: Adicionar campos de segurança ao modelo User

Adiciona campos para:
- Tipo de usuário (frontend/device)
- Status (active/inactive/blocked)
- Controle de tentativas de login
- Bloqueio temporário
"""
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def upgrade():
    """Aplica a migration."""
    async with AsyncSessionLocal() as db:
        try:
            # 1. Criar enum UserStatus
            await db.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE userstatus AS ENUM ('active', 'inactive', 'blocked');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            
            # 2. Criar enum UserType
            await db.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE usertype AS ENUM ('frontend', 'device');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            
            # 3. Adicionar colunas ao modelo User
            await db.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS user_type usertype DEFAULT 'frontend' NOT NULL,
                ADD COLUMN IF NOT EXISTS status userstatus DEFAULT 'active' NOT NULL,
                ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45),
                ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
                ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
            """))
            
            # 4. Criar índices
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
            """))
            
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
            """))
            
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_username_type ON users(username, user_type);
            """))
            
            await db.commit()
            
            print("✅ Campos de segurança adicionados ao modelo User!")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Erro ao adicionar campos de segurança: {e}")
            raise


async def downgrade():
    """Reverte a migration."""
    async with AsyncSessionLocal() as db:
        try:
            # Remover colunas
            await db.execute(text("""
                ALTER TABLE users
                DROP COLUMN IF EXISTS user_type,
                DROP COLUMN IF EXISTS status,
                DROP COLUMN IF EXISTS last_login_at,
                DROP COLUMN IF EXISTS last_login_ip,
                DROP COLUMN IF EXISTS failed_login_attempts,
                DROP COLUMN IF EXISTS locked_until;
            """))
            
            # Remover enums (se não houver outras referências)
            await db.execute(text("DROP TYPE IF EXISTS userstatus CASCADE;"))
            await db.execute(text("DROP TYPE IF EXISTS usertype CASCADE;"))
            
            await db.commit()
            
            print("✅ Campos de segurança removidos")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Erro ao reverter: {e}")
            raise
