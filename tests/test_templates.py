"""Tests for template endpoints."""

from datetime import datetime

import pytest
import pytest_asyncio
from quart import Quart
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from hopthu.app.models import Base, Account, Mailbox, Email, EMAIL_STATUS_NEW
from hopthu.app.routes import templates as templates_routes
from hopthu.app.routes.templates import bp


@pytest_asyncio.fixture(loop_scope="function")
async def setup_db():
    """Set up and tear down a fresh database for each test."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    original_session = templates_routes.AsyncSession
    templates_routes.AsyncSession = AsyncSessionLocal

    yield engine

    templates_routes.AsyncSession = original_session
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="function")
async def app(setup_db):
    """Create a test Quart app."""
    app = Quart(__name__)
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret-key"
    app.register_blueprint(bp)
    yield app


@pytest_asyncio.fixture(loop_scope="function")
async def client(app):
    """Create a test client."""
    async with app.test_client() as test_client:
        yield test_client


@pytest_asyncio.fixture(loop_scope="function")
async def auth_client(client):
    """Create an authenticated test client."""
    async with client.session_transaction() as sess:
        sess["user"] = "admin"
    yield client


async def create_sample_email(engine):
    """Helper to create a sample email and return its ID."""
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        account = Account(
            email="test@example.com",
            host="imap.example.com",
            port=993,
            credential="encrypted"
        )
        session.add(account)
        await session.flush()

        mailbox = Mailbox(
            account_id=account.id,
            name="INBOX",
            is_active=True
        )
        session.add(mailbox)
        await session.flush()

        email = Email(
            account_id=account.id,
            mailbox_id=mailbox.id,
            from_email="bank@example.com",
            subject="Payment Notification",
            content_type="text/plain",
            body="Amount: 500000 VND",
            message_id="<msg123@example.com>",
            status=EMAIL_STATUS_NEW,
            received_at=datetime(2026, 4, 9, 10, 0, 0)
        )
        session.add(email)
        await session.commit()

        return email.id


class TestDryRunTemplate:
    """Tests for POST /api/templates/dry-run."""

    @pytest.mark.asyncio
    async def test_dry_run_returns_extracted_variables(self, setup_db, auth_client):
        email_id = await create_sample_email(setup_db)

        response = await auth_client.post(
            "/api/templates/dry-run",
            json={"email_id": email_id, "template": "Amount: {{amount}} VND"}
        )
        data = await response.get_json()

        assert response.status_code == 200
        assert data["error"] is None
        assert data["data"] == {"amount": "500000"}

    @pytest.mark.asyncio
    async def test_dry_run_requires_email_id(self, setup_db, auth_client):
        response = await auth_client.post(
            "/api/templates/dry-run",
            json={"template": "Amount: {{amount}} VND"}
        )
        data = await response.get_json()

        assert response.status_code == 400
        assert data["data"] is None
        assert "email_id" in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_dry_run_requires_template(self, setup_db, auth_client):
        response = await auth_client.post(
            "/api/templates/dry-run",
            json={"email_id": 1}
        )
        data = await response.get_json()

        assert response.status_code == 400
        assert data["data"] is None
        assert "template" in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_dry_run_email_not_found(self, setup_db, auth_client):
        response = await auth_client.post(
            "/api/templates/dry-run",
            json={"email_id": 9999, "template": "Amount: {{amount}} VND"}
        )
        data = await response.get_json()

        assert response.status_code == 404
        assert data["data"] is None
        assert "not found" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_dry_run_template_does_not_match(self, setup_db, auth_client):
        email_id = await create_sample_email(setup_db)

        response = await auth_client.post(
            "/api/templates/dry-run",
            json={"email_id": email_id, "template": "Balance: {{balance}} USD"}
        )
        data = await response.get_json()

        assert response.status_code == 400
        assert data["data"] is None
        assert "did not match" in data["error"]["message"]
