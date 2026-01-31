"""
Script para garantir que o banco exista antes das migrations.
"""
import asyncio
import os
import re
from urllib.parse import urlparse

import asyncpg


def _parse_db_settings():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        parsed = urlparse(database_url)
        user = parsed.username or os.getenv("POSTGRES_USER", "easysmart")
        password = parsed.password or os.getenv("POSTGRES_PASSWORD", "easysmart_password")
        host = parsed.hostname or os.getenv("POSTGRES_HOST", "localhost")
        port = parsed.port or int(os.getenv("POSTGRES_PORT", "5432"))
        db_name = (parsed.path or "").lstrip("/") or os.getenv("POSTGRES_DB", "easysmart_db")
        return user, password, host, port, db_name

    user = os.getenv("POSTGRES_USER", "easysmart")
    password = os.getenv("POSTGRES_PASSWORD", "easysmart_password")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = int(os.getenv("POSTGRES_PORT", "5432"))
    db_name = os.getenv("POSTGRES_DB", "easysmart_db")
    return user, password, host, port, db_name


def _safe_identifier(value: str) -> str:
    if not value or not re.match(r"^[A-Za-z0-9_]+$", value):
        raise ValueError("Nome de banco inválido.")
    return f'"{value}"'


async def ensure_database():
    user, password, host, port, db_name = _parse_db_settings()
    maintenance_db = os.getenv("POSTGRES_MAINTENANCE_DB", "postgres")
    database_identifier = _safe_identifier(db_name)

    conn = await asyncpg.connect(
        user=user,
        password=password,
        host=host,
        port=port,
        database=maintenance_db,
    )
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1;",
            db_name,
        )
        if not exists:
            await conn.execute(f"CREATE DATABASE {database_identifier};")
            print(f"✅ Banco criado: {db_name}")
        else:
            print(f"✅ Banco já existe: {db_name}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(ensure_database())

