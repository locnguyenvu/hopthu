"""Test database setup and migrations."""

import os
import tempfile

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from hopthu.app.models import Base


@pytest_asyncio.fixture
async def db_session():
    """Create a temporary database for testing."""
    # Create a temporary database file
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    # Create async engine
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    AsyncSession = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSession() as session:
        yield session

    # Cleanup
    await engine.dispose()
    os.unlink(db_path)


@pytest.mark.asyncio
async def test_tables_exist(db_session):
    """Test that all required tables exist."""
    async with db_session.bind.connect() as conn:
        # Get list of tables
        result = await conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table'")
        )
        tables = {row[0] for row in result.fetchall()}

        # Check that our tables exist
        required_tables = {"accounts", "mailboxes", "emails", "templates", "email_data"}
        for table in required_tables:
            assert table in tables, f"Table '{table}' does not exist"


@pytest.mark.asyncio
async def test_foreign_keys_enabled(db_session):
    """Test that foreign keys are enabled."""
    async with db_session.bind.connect() as conn:
        result = await conn.execute(text("PRAGMA foreign_keys"))
        row = result.fetchone()
        assert row[0] == 1, "Foreign keys should be enabled"


@pytest.mark.asyncio
async def test_wal_mode_enabled(db_session):
    """Test that WAL mode is enabled."""
    async with db_session.bind.connect() as conn:
        result = await conn.execute(text("PRAGMA journal_mode"))
        row = result.fetchone()
        assert row[0].lower() == "wal", "WAL mode should be enabled"
