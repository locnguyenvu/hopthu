"""Tests for trigger endpoints."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from quart import Quart
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from hopthu.app.models import (
    Base, Account, Mailbox, Email, Template, EmailData, Connection, Trigger, TriggerLog
)
from hopthu.app.routes import triggers as triggers_routes
from hopthu.app.routes.triggers import bp
from hopthu.app import config


@pytest_asyncio.fixture(loop_scope="function")
async def setup_db():
    """Set up and tear down a fresh database for each test."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    from sqlalchemy import event

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    # Save original and patch routes module's AsyncSession
    original_session = triggers_routes.AsyncSession
    triggers_routes.AsyncSession = AsyncSessionLocal

    yield engine

    triggers_routes.AsyncSession = original_session
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
    """Helper to create sample data."""
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        # Create account
        account = Account(
            email="test@example.com",
            host="imap.example.com",
            port=993,
            credential="encrypted"
        )
        session.add(account)
        await session.flush()

        # Create mailbox
        mailbox = Mailbox(
            account_id=account.id,
            name="INBOX",
            is_active=True
        )
        session.add(mailbox)
        await session.flush()

        # Create template
        template = Template(
            from_email="bank@example.com",
            subject="Payment",
            content_type="text/plain",
            template="Amount: {{amount}} VND",
            fields=[{"name": "amount"}]
        )
        session.add(template)
        await session.flush()

        # Create connection
        connection = Connection(
            name="Test Webhook",
            endpoint="https://api.example.com/webhook",
            method="POST",
            headers=[{"key": "Content-Type", "value": "application/json", "encrypted": False}]
        )
        session.add(connection)
        await session.flush()

        # Create trigger
        trigger = Trigger(
            name="Payment Trigger",
            template_id=template.id,
            connection_id=connection.id,
            is_active=True,
            field_mappings=[{"source": "$extracted_data.amount", "target": "payment.amount"}]
        )
        session.add(trigger)
        await session.commit()
        await session.refresh(trigger)

        return {
            "template_id": template.id,
            "connection_id": connection.id,
            "trigger_id": trigger.id
        }


class TestListTriggers:
    """Tests for list triggers endpoint."""

    @pytest.mark.asyncio
    async def test_list_triggers_empty(self, auth_client, setup_db):
        """Test listing triggers when empty."""
        response = await auth_client.get("/api/triggers")
        data = await response.get_json()

        assert response.status_code == 200
        assert data["error"] is None
        assert len(data["data"]) == 0

    @pytest.mark.asyncio
    async def test_list_triggers_success(self, auth_client, setup_db):
        """Test listing all triggers."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.get("/api/triggers")
        data = await response.get_json()

        assert response.status_code == 200
        assert data["error"] is None
        assert len(data["data"]) == 1
        assert data["data"][0]["name"] == "Payment Trigger"

    @pytest.mark.asyncio
    async def test_list_triggers_filter_by_template(self, auth_client, setup_db):
        """Test filtering triggers by template_id."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.get(f"/api/triggers?template_id={sample['template_id']}")
        data = await response.get_json()

        assert response.status_code == 200
        assert len(data["data"]) == 1

    @pytest.mark.asyncio
    async def test_list_triggers_unauthorized(self, client):
        """Test listing triggers without auth."""
        response = await client.get("/api/triggers")
        assert response.status_code == 401


class TestCreateTrigger:
    """Tests for create trigger endpoint."""

    @pytest.mark.asyncio
    async def test_create_trigger_success(self, auth_client, setup_db):
        """Test creating a new trigger."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.post("/api/triggers", json={
            "name": "New Trigger",
            "template_id": sample["template_id"],
            "connection_id": sample["connection_id"],
            "is_active": True,
            "field_mappings": [{"source": "$extracted_data.amount", "target": "txn.value"}]
        })
        data = await response.get_json()

        assert response.status_code == 201
        assert data["error"] is None
        assert data["data"]["name"] == "New Trigger"
        assert data["data"]["is_active"] is True

    @pytest.mark.asyncio
    async def test_create_trigger_missing_name(self, auth_client, setup_db):
        """Test creating trigger without name."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.post("/api/triggers", json={
            "template_id": sample["template_id"],
            "connection_id": sample["connection_id"]
        })
        data = await response.get_json()

        assert response.status_code == 400
        assert "name is required" in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_create_trigger_invalid_template(self, auth_client, setup_db):
        """Test creating trigger with invalid template_id."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.post("/api/triggers", json={
            "name": "Test",
            "template_id": 999,
            "connection_id": sample["connection_id"]
        })
        data = await response.get_json()

        assert response.status_code == 400
        assert "Template not found" in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_create_trigger_invalid_connection(self, auth_client, setup_db):
        """Test creating trigger with invalid connection_id."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.post("/api/triggers", json={
            "name": "Test",
            "template_id": sample["template_id"],
            "connection_id": 999
        })
        data = await response.get_json()

        assert response.status_code == 400
        assert "Connection not found" in data["error"]["message"]


class TestGetTrigger:
    """Tests for get trigger endpoint."""

    @pytest.mark.asyncio
    async def test_get_trigger_success(self, auth_client, setup_db):
        """Test getting a trigger by ID."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.get(f"/api/triggers/{sample['trigger_id']}")
        data = await response.get_json()

        assert response.status_code == 200
        assert data["error"] is None
        assert data["data"]["name"] == "Payment Trigger"
        assert data["data"]["connection"]["name"] == "Test Webhook"

    @pytest.mark.asyncio
    async def test_get_trigger_not_found(self, auth_client):
        """Test getting a non-existent trigger."""
        response = await auth_client.get("/api/triggers/999")
        data = await response.get_json()

        assert response.status_code == 404
        assert "Trigger not found" in data["error"]["message"]


class TestUpdateTrigger:
    """Tests for update trigger endpoint."""

    @pytest.mark.asyncio
    async def test_update_trigger_name(self, auth_client, setup_db):
        """Test updating trigger name."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.put(f"/api/triggers/{sample['trigger_id']}", json={
            "name": "Updated Name"
        })
        data = await response.get_json()

        assert response.status_code == 200
        assert data["data"]["name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_trigger_is_active(self, auth_client, setup_db):
        """Test updating trigger active status."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.put(f"/api/triggers/{sample['trigger_id']}", json={
            "is_active": False
        })
        data = await response.get_json()

        assert response.status_code == 200
        assert data["data"]["is_active"] is False

    @pytest.mark.asyncio
    async def test_update_trigger_not_found(self, auth_client):
        """Test updating non-existent trigger."""
        response = await auth_client.put("/api/triggers/999", json={"name": "Test"})
        data = await response.get_json()

        assert response.status_code == 404


class TestDeleteTrigger:
    """Tests for delete trigger endpoint."""

    @pytest.mark.asyncio
    async def test_delete_trigger_success(self, auth_client, setup_db):
        """Test deleting a trigger."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.delete(f"/api/triggers/{sample['trigger_id']}")
        data = await response.get_json()

        assert response.status_code == 200
        assert data["data"]["deleted"] is True

    @pytest.mark.asyncio
    async def test_delete_trigger_not_found(self, auth_client):
        """Test deleting non-existent trigger."""
        response = await auth_client.delete("/api/triggers/999")
        data = await response.get_json()

        assert response.status_code == 404


class TestTriggerLogs:
    """Tests for trigger logs endpoints."""

    @pytest.mark.asyncio
    async def test_get_trigger_logs_empty(self, auth_client, setup_db):
        """Test getting logs for trigger with no logs."""
        sample = await create_sample_data(setup_db)

        response = await auth_client.get(f"/api/triggers/{sample['trigger_id']}/logs")
        data = await response.get_json()

        assert response.status_code == 200
        assert data["data"]["logs"] == []
        assert data["data"]["total"] == 0

    @pytest.mark.asyncio
    async def test_get_trigger_logs_with_data(self, auth_client, setup_db):
        """Test getting logs when trigger has executed."""
        sample = await create_sample_data(setup_db)
        AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)

        # Create a log entry
        async with AsyncSessionLocal() as session:
            log = TriggerLog(
                trigger_id=sample["trigger_id"],
                email_id=None,
                request_url="https://api.example.com/webhook",
                request_method="POST",
                request_headers={"Content-Type": "application/json"},
                request_body={"payment": {"amount": "500000"}},
                response_status=200,
                response_body="ok",
                status="success",
                executed_at=datetime.utcnow()
            )
            session.add(log)
            await session.commit()

        response = await auth_client.get(f"/api/triggers/{sample['trigger_id']}/logs")
        data = await response.get_json()

        assert response.status_code == 200
        assert len(data["data"]["logs"]) == 1
        assert data["data"]["logs"][0]["status"] == "success"

    @pytest.mark.asyncio
    async def test_list_all_trigger_logs(self, auth_client, setup_db):
        """Test listing all trigger logs."""
        sample = await create_sample_data(setup_db)
        AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)

        # Create a log entry
        async with AsyncSessionLocal() as session:
            log = TriggerLog(
                trigger_id=sample["trigger_id"],
                email_id=None,
                request_url="https://api.example.com/webhook",
                request_method="POST",
                request_headers={},
                request_body={},
                response_status=200,
                response_body="ok",
                status="success",
                executed_at=datetime.utcnow()
            )
            session.add(log)
            await session.commit()

        response = await auth_client.get("/api/trigger-logs")
        data = await response.get_json()

        assert response.status_code == 200
        assert len(data["data"]["logs"]) == 1
        assert data["data"]["logs"][0]["trigger_name"] == "Payment Trigger"


class TestTestTrigger:
    """Tests for trigger test endpoint."""

    @pytest.mark.asyncio
    async def test_test_trigger_success(self, auth_client, setup_db):
        """Test executing a trigger with sample data."""
        sample = await create_sample_data(setup_db)

        # Mock HTTP request
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='{"ok": true}')

        class MockRequestContextManager:
            def __init__(self, *args, **kwargs):
                pass
            async def __aenter__(self):
                return mock_response
            async def __aexit__(self, *args):
                return None

        mock_session = AsyncMock()
        mock_session.request = MockRequestContextManager
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)

        with patch("aiohttp.ClientSession", return_value=mock_session):
            response = await auth_client.post(f"/api/triggers/{sample['trigger_id']}/test", json={
                "extracted_data": {"amount": "500000"}
            })
            data = await response.get_json()

        assert response.status_code == 200
        assert data["data"]["success"] is True
        assert data["data"]["response_status"] == 200
        assert data["data"]["request_body"] == {"payment": {"amount": "500000"}}