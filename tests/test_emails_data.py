"""Tests for POST /api/emails/<id>/data and POST /api/emails/<id>/run-trigger endpoints."""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import pytest_asyncio
from quart import Quart
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from hopthu.app.models import (
    Base,
    Account,
    Mailbox,
    Email,
    EmailData,
    Template,
    EMAIL_STATUS_NEW,
    EMAIL_STATUS_EXTRACTED,
    EMAIL_STATUS_PUSHED,
)
from hopthu.app.routes import emails as emails_routes
from hopthu.app.routes.emails import bp


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

    original_session = emails_routes.AsyncSession
    emails_routes.AsyncSession = AsyncSessionLocal

    yield engine

    emails_routes.AsyncSession = original_session
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


async def create_sample_data(engine):
    """Helper to create a sample account, mailbox, email and template.

    Returns (email_id, template_id).
    """
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        account = Account(
            email="test@example.com",
            host="imap.example.com",
            port=993,
            credential="encrypted",
        )
        session.add(account)
        await session.flush()

        mailbox = Mailbox(account_id=account.id, name="INBOX", is_active=True)
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
            received_at=datetime(2026, 4, 9, 10, 0, 0),
        )
        session.add(email)

        template = Template(
            from_email="bank@example.com",
            subject="Payment Notification",
            content_type="text/plain",
            template="Amount: {amount}",
            fields=[{"name": "amount", "type": "string"}],
        )
        session.add(template)
        await session.commit()

        return email.id, template.id


@pytest.mark.asyncio(loop_scope="function")
async def test_save_email_data_requires_auth(client, setup_db):
    """Unauthenticated requests are rejected."""
    email_id, template_id = await create_sample_data(setup_db)
    response = await client.post(
        f"/api/emails/{email_id}/data",
        json={"template_id": template_id, "extracted_data": {"amount": "500000"}},
    )
    assert response.status_code == 401


@pytest.mark.asyncio(loop_scope="function")
async def test_save_email_data_creates_record(auth_client, setup_db):
    """POST creates a new email_data record and marks email as extracted."""
    email_id, template_id = await create_sample_data(setup_db)

    response = await auth_client.post(
        f"/api/emails/{email_id}/data",
        json={
            "template_id": template_id,
            "extracted_data": {"amount": "500000", "currency": "VND"},
        },
    )

    assert response.status_code == 201
    body = await response.get_json()
    assert body["error"] is None
    assert body["data"]["template_id"] == template_id
    assert body["data"]["data"]["extracted_data"] == {
        "amount": "500000",
        "currency": "VND",
    }
    assert body["data"]["data"]["meta_data"] == {
        "received_at": "2026-04-09T10:00:00"
    }

    # Verify DB state
    AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(EmailData).where(EmailData.email_id == email_id)
        )
        email_data = result.scalar_one()
        assert email_data.template_id == template_id

        result = await session.execute(select(Email).where(Email.id == email_id))
        email = result.scalar_one()
        assert email.status == EMAIL_STATUS_EXTRACTED


@pytest.mark.asyncio(loop_scope="function")
async def test_save_email_data_updates_existing(auth_client, setup_db):
    """POST updates an existing email_data record instead of duplicating."""
    email_id, template_id = await create_sample_data(setup_db)

    # Create initial record
    response = await auth_client.post(
        f"/api/emails/{email_id}/data",
        json={"template_id": template_id, "extracted_data": {"amount": "100"}},
    )
    assert response.status_code == 201

    # Update it
    response = await auth_client.post(
        f"/api/emails/{email_id}/data",
        json={"template_id": template_id, "extracted_data": {"amount": "999"}},
    )
    assert response.status_code == 200

    # Verify only one record exists with updated data
    AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(EmailData).where(EmailData.email_id == email_id)
        )
        records = result.scalars().all()
        assert len(records) == 1
        assert records[0].data["extracted_data"] == {"amount": "999"}


@pytest.mark.asyncio(loop_scope="function")
async def test_save_email_data_validation_errors(auth_client, setup_db):
    """Missing/invalid payload fields and unknown IDs return proper errors."""
    email_id, template_id = await create_sample_data(setup_db)

    # Missing template_id
    response = await auth_client.post(
        f"/api/emails/{email_id}/data",
        json={"extracted_data": {"amount": "100"}},
    )
    assert response.status_code == 400

    # extracted_data not a JSON object
    response = await auth_client.post(
        f"/api/emails/{email_id}/data",
        json={"template_id": template_id, "extracted_data": "not-an-object"},
    )
    assert response.status_code == 400

    # Unknown email
    response = await auth_client.post(
        "/api/emails/99999/data",
        json={"template_id": template_id, "extracted_data": {"amount": "100"}},
    )
    assert response.status_code == 404

    # Unknown template
    response = await auth_client.post(
        f"/api/emails/{email_id}/data",
        json={"template_id": 99999, "extracted_data": {"amount": "100"}},
    )
    assert response.status_code == 404


@pytest.mark.asyncio(loop_scope="function")
async def test_run_trigger_requires_auth(client, setup_db):
    """Unauthenticated requests are rejected."""
    email_id, _ = await create_sample_data(setup_db)
    response = await client.post(f"/api/emails/{email_id}/run-trigger")
    assert response.status_code == 401


@pytest.mark.asyncio(loop_scope="function")
async def test_run_trigger_email_not_found(auth_client, setup_db):
    """Unknown email returns 404."""
    response = await auth_client.post("/api/emails/99999/run-trigger")
    assert response.status_code == 404


@pytest.mark.asyncio(loop_scope="function")
async def test_run_trigger_without_data(auth_client, setup_db):
    """Email without extracted data returns 400."""
    email_id, _ = await create_sample_data(setup_db)
    response = await auth_client.post(f"/api/emails/{email_id}/run-trigger")
    assert response.status_code == 400
    body = await response.get_json()
    assert body["data"] is None
    assert "no extracted data" in body["error"]["message"].lower()


@pytest.mark.asyncio(loop_scope="function")
async def test_run_trigger_with_data_no_triggers(auth_client, setup_db):
    """Email with extracted data but no matching triggers returns empty list."""
    email_id, template_id = await create_sample_data(setup_db)

    # Save extracted data first
    response = await auth_client.post(
        f"/api/emails/{email_id}/data",
        json={"template_id": template_id, "extracted_data": {"amount": "500000"}},
    )
    assert response.status_code == 201

    response = await auth_client.post(f"/api/emails/{email_id}/run-trigger")
    assert response.status_code == 200
    body = await response.get_json()
    assert body["error"] is None
    assert body["data"] == []


@pytest.mark.asyncio(loop_scope="function")
async def test_run_trigger_marks_email_pushed_on_success(auth_client, setup_db):
    """A successful trigger request updates the email status to pushed."""
    email_id, template_id = await create_sample_data(setup_db)

    response = await auth_client.post(
        f"/api/emails/{email_id}/data",
        json={"template_id": template_id, "extracted_data": {"amount": "500000"}},
    )
    assert response.status_code == 201

    fake_log = SimpleNamespace(
        status="success",
        to_dict=lambda: {"id": 1, "status": "success"},
    )

    async def fake_run_triggers(email_id_arg, connection=None):
        return [fake_log]

    with patch(
        "hopthu.app.services.trigger.run_triggers_for_email", fake_run_triggers
    ):
        response = await auth_client.post(f"/api/emails/{email_id}/run-trigger")

    assert response.status_code == 200
    body = await response.get_json()
    assert body["data"] == [{"id": 1, "status": "success"}]

    AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Email).where(Email.id == email_id))
        email = result.scalar_one()
        assert email.status == EMAIL_STATUS_PUSHED


@pytest.mark.asyncio(loop_scope="function")
async def test_run_trigger_keeps_status_on_failure(auth_client, setup_db):
    """A failed trigger request does not change the email status."""
    email_id, template_id = await create_sample_data(setup_db)

    response = await auth_client.post(
        f"/api/emails/{email_id}/data",
        json={"template_id": template_id, "extracted_data": {"amount": "500000"}},
    )
    assert response.status_code == 201

    fake_log = SimpleNamespace(
        status="failed",
        to_dict=lambda: {"id": 1, "status": "failed"},
    )

    async def fake_run_triggers(email_id_arg, connection=None):
        return [fake_log]

    with patch(
        "hopthu.app.services.trigger.run_triggers_for_email", fake_run_triggers
    ):
        response = await auth_client.post(f"/api/emails/{email_id}/run-trigger")

    assert response.status_code == 200

    AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Email).where(Email.id == email_id))
        email = result.scalar_one()
        assert email.status == EMAIL_STATUS_EXTRACTED
