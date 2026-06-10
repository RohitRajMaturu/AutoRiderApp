import asyncpg
from .config import get_settings

pool: asyncpg.Pool | None = None


async def connect_db() -> None:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(dsn=get_settings().database_url, min_size=1, max_size=10)


async def close_db() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None


def get_pool() -> asyncpg.Pool:
    if pool is None:
        raise RuntimeError("Database pool is not initialized")
    return pool
