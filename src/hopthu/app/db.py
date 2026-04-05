"""Database setup with SQLAlchemy async engine and session."""
import os

from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from hopthu.app.models import Base

DB_PATH = os.getenv("QUART_DB_PATH", "")

# Create async engine with aiosqlite
engine = create_async_engine(f"sqlite+aiosqlite:///{DB_PATH}")


@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign keys and WAL mode on connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


# Async session factory
AsyncSession = async_sessionmaker(engine, expire_on_commit=False)


async def init_db():
    """Initialize database tables (for testing only - use Alembic in production)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
