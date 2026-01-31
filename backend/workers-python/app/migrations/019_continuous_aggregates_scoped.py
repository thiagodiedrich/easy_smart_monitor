"""
Migration 019: Recriar continuous aggregates com tenant/org/workspace
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings


async def upgrade():
    autocommit_engine = create_async_engine(
        settings.DATABASE_URL,
        isolation_level="AUTOCOMMIT",
        pool_pre_ping=True,
    )
    async with autocommit_engine.connect() as conn:
        try:
            await conn.execute(text("DROP MATERIALIZED VIEW IF EXISTS telemetry_daily CASCADE;"))
            await conn.execute(text("DROP MATERIALIZED VIEW IF EXISTS telemetry_hourly CASCADE;"))

            await conn.execute(text("""
                CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_hourly
                WITH (timescaledb.continuous) AS
                SELECT
                    time_bucket('1 hour', timestamp) AS bucket,
                    tenant_id,
                    organization_id,
                    workspace_id,
                    equipment_id,
                    sensor_id,
                    AVG(value) AS avg_value,
                    MAX(value) AS max_value,
                    MIN(value) AS min_value,
                    COUNT(*) AS sample_count,
                    COUNT(DISTINCT DATE_TRUNC('minute', timestamp)) AS active_minutes,
                    STDDEV(value) AS stddev_value,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) AS median_value,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) AS p95_value,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) AS p99_value
                FROM telemetry_data
                GROUP BY 
                    time_bucket('1 hour', timestamp),
                    tenant_id,
                    organization_id,
                    workspace_id,
                    equipment_id,
                    sensor_id;
            """))

            await conn.execute(text("""
                CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_daily
                WITH (timescaledb.continuous) AS
                SELECT
                    time_bucket('1 day', timestamp) AS bucket,
                    tenant_id,
                    organization_id,
                    workspace_id,
                    equipment_id,
                    sensor_id,
                    AVG(value) AS avg_value,
                    MAX(value) AS max_value,
                    MIN(value) AS min_value,
                    COUNT(*) AS sample_count,
                    COUNT(DISTINCT DATE_TRUNC('hour', timestamp)) AS active_hours,
                    STDDEV(value) AS stddev_value,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) AS median_value,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) AS p95_value,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) AS p99_value
                FROM telemetry_data
                GROUP BY 
                    time_bucket('1 day', timestamp),
                    tenant_id,
                    organization_id,
                    workspace_id,
                    equipment_id,
                    sensor_id;
            """))

            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_telemetry_hourly_tenant_bucket 
                ON telemetry_hourly (tenant_id, bucket DESC);
            """))
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_telemetry_daily_tenant_bucket 
                ON telemetry_daily (tenant_id, bucket DESC);
            """))
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_telemetry_hourly_equipment_bucket 
                ON telemetry_hourly (equipment_id, bucket DESC);
            """))
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_telemetry_daily_equipment_bucket 
                ON telemetry_daily (equipment_id, bucket DESC);
            """))
        except Exception as e:
            raise
    await autocommit_engine.dispose()


async def downgrade():
    autocommit_engine = create_async_engine(
        settings.DATABASE_URL,
        isolation_level="AUTOCOMMIT",
        pool_pre_ping=True,
    )
    async with autocommit_engine.connect() as conn:
        try:
            await conn.execute(text("DROP MATERIALIZED VIEW IF EXISTS telemetry_daily CASCADE;"))
            await conn.execute(text("DROP MATERIALIZED VIEW IF EXISTS telemetry_hourly CASCADE;"))
        except Exception:
            raise
    await autocommit_engine.dispose()
