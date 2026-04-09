"""Tests for Connection CRUD endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from quart import Quart
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from hopthu.app.models import Base, Template, Connection, Trigger
from hopthu.app.routes import connections as connections_routes
from hopthu.app.routes.connections import bp
from hopthu.app import config


@pytest_asyncio.fixture
async def setup_db():
    """Set up and tear down a fresh database for each test."""
    # Create in-memory database
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    from sqlalchemy import event

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session factory
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    # Save original and patch the routes module's AsyncSession
    original_session = connections_routes.AsyncSession
    connections_routes.AsyncSession = AsyncSessionLocal

    yield engine

    # Restore original session
    connections_routes.AsyncSession = original_session

    await engine.dispose()


@pytest_asyncio.fixture
async def app(setup_db):
    """Create a test Quart app."""
    app = Quart(__name__)
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret-key"
    app.config["USER_PASSWORD_HASH"] = ""
    app.register_blueprint(bp)
    yield app


@pytest_asyncio.fixture
async def client(app):
    """Create a test client."""
    async with app.test_client() as test_client:
        yield test_client


@pytest_asyncio.fixture
async def auth_client(client):
    """Create an authenticated test client."""
    async with client.session_transaction() as sess:
        sess["user"] = "admin"
    yield client


async def create_sample_connection(engine):
    """Helper to create a sample connection."""
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        connection = Connection(
            name="Test Webhook",
            endpoint="https://api.example.com/webhook",
            method="POST",
            headers=[
                {"key": "Content-Type", "value": "application/json", "encrypted": False},
                {"key": "Authorization", "value": config.encrypt_credential("secret_token"), "encrypted": True}
            ]
        )
        session.add(connection)
        await session.commit()
        await session.refresh(connection)
        return connection


async def create_sample_template(engine):
    """Helper to create a sample template."""
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        template = Template(
            from_email="sender@example.com",
            subject="Test",
            content_type="text/plain",
            template="Hello {{name}}",
            fields=["name"]
        )
        session.add(template)
        await session.commit()
        await session.refresh(template)
        return template


class TestConnectionEndpoints:
    """Tests for connection CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_list_connections(self, auth_client, setup_db):
        """Test listing connections."""
        await create_sample_connection(setup_db)
        
        response = await auth_client.get("/api/connections")
        data = await response.get_json()

        assert response.status_code == 200
        assert data["error"] is None
        assert len(data["data"]) == 1
        assert data["data"][0]["name"] == "Test Webhook"

    @pytest.mark.asyncio
    async def test_list_connections_empty(self, auth_client):
        """Test listing connections when empty."""
        response = await auth_client.get("/api/connections")
        data = await response.get_json()

        assert response.status_code == 200
        assert data["error"] is None
        assert len(data["data"]) == 0

    @pytest.mark.asyncio
    async def test_create_connection(self, auth_client):
        """Test creating a connection."""
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "New Webhook",
                "endpoint": "https://new.api.com/webhook",
                "method": "POST",
                "headers": [{"key": "X-API-Key", "value": "plain_key", "encrypted": False}]
            }
        )
        data = await response.get_json()

        assert response.status_code == 201
        assert data["error"] is None
        assert data["data"]["name"] == "New Webhook"
        assert data["data"]["endpoint"] == "https://new.api.com/webhook"

    @pytest.mark.asyncio
    async def test_create_connection_with_encrypted_header(self, auth_client):
        """Test creating a connection with encrypted header."""
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "Secure Webhook",
                "endpoint": "https://secure.api.com/webhook",
                "method": "POST",
                "headers": [{"key": "Authorization", "value": "secret_token", "encrypted": True}]
            }
        )
        data = await response.get_json()

        assert response.status_code == 201
        assert data["error"] is None
        assert data["data"]["headers"][0]["value"] == "••••••"

    @pytest.mark.asyncio
    async def test_create_connection_missing_fields(self, auth_client):
        """Test creating a connection with missing required fields."""
        response = await auth_client.post(
            "/api/connections",
            json={"name": "Incomplete"}
        )
        data = await response.get_json()

        assert response.status_code == 400
        assert data["error"] is not None

    @pytest.mark.asyncio
    async def test_create_connection_duplicate_name(self, auth_client, setup_db):
        """Test creating a connection with duplicate name."""
        await create_sample_connection(setup_db)
        
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "Test Webhook",
                "endpoint": "https://other.api.com/webhook",
                "method": "POST"
            }
        )
        data = await response.get_json()

        assert response.status_code == 400
        assert data["error"] is not None

    @pytest.mark.asyncio
    async def test_get_connection(self, auth_client, setup_db):
        """Test getting a single connection."""
        connection = await create_sample_connection(setup_db)
        
        response = await auth_client.get(f"/api/connections/{connection.id}")
        data = await response.get_json()

        assert response.status_code == 200
        assert data["error"] is None
        assert data["data"]["name"] == "Test Webhook"
        encrypted_header = next((h for h in data["data"]["headers"] if h["encrypted"]), None)
        assert encrypted_header is not None
        assert encrypted_header["value"] == "••••••"

    @pytest.mark.asyncio
    async def test_get_connection_not_found(self, auth_client):
        """Test getting a non-existent connection."""
        response = await auth_client.get("/api/connections/999")
        data = await response.get_json()

        assert response.status_code == 404
        assert data["error"] is not None

    @pytest.mark.asyncio
    async def test_update_connection(self, auth_client, setup_db):
        """Test updating a connection."""
        connection = await create_sample_connection(setup_db)
        
        response = await auth_client.put(
            f"/api/connections/{connection.id}",
            json={
                "name": "Updated Webhook",
                "endpoint": "https://updated.api.com/webhook"
            }
        )
        data = await response.get_json()

        assert response.status_code == 200
        assert data["error"] is None
        assert data["data"]["name"] == "Updated Webhook"
        assert data["data"]["endpoint"] == "https://updated.api.com/webhook"
        encrypted_header = next((h for h in data["data"]["headers"] if h["encrypted"]), None)
        assert encrypted_header is not None
        assert encrypted_header["value"] == "••••••"

    @pytest.mark.asyncio
    async def test_update_connection_keep_encrypted(self, auth_client, setup_db):
        """Test updating a connection keeps encrypted values intact."""
        connection = await create_sample_connection(setup_db)
        
        response = await auth_client.put(
            f"/api/connections/{connection.id}",
            json={"name": "Renamed Webhook"}
        )
        data = await response.get_json()

        assert response.status_code == 200
        encrypted_header = next((h for h in data["data"]["headers"] if h["encrypted"]), None)
        assert encrypted_header is not None
        assert encrypted_header["key"] == "Authorization"

    @pytest.mark.asyncio
    async def test_update_connection_new_encrypted_header(self, auth_client, setup_db):
        """Test updating a connection with new encrypted header."""
        connection = await create_sample_connection(setup_db)
        
        response = await auth_client.put(
            f"/api/connections/{connection.id}",
            json={
                "headers": [
                    {"key": "X-New-Token", "value": "new_secret", "encrypted": True}
                ]
            }
        )
        data = await response.get_json()

        assert response.status_code == 200
        assert len(data["data"]["headers"]) == 1
        assert data["data"]["headers"][0]["value"] == "••••••"

    @pytest.mark.asyncio
    async def test_update_connection_not_found(self, auth_client):
        """Test updating a non-existent connection."""
        response = await auth_client.put(
            "/api/connections/999",
            json={"name": "Ghost"}
        )
        data = await response.get_json()

        assert response.status_code == 404
        assert data["error"] is not None

    @pytest.mark.asyncio
    async def test_delete_connection(self, auth_client, setup_db):
        """Test deleting a connection."""
        connection = await create_sample_connection(setup_db)
        
        response = await auth_client.delete(f"/api/connections/{connection.id}")
        data = await response.get_json()

        assert response.status_code == 200
        assert data["data"]["deleted"] is True

        # Verify connection is deleted
        AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Connection).where(Connection.id == connection.id)
            )
            assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_delete_connection_not_found(self, auth_client):
        """Test deleting a non-existent connection."""
        response = await auth_client.delete("/api/connections/999")
        data = await response.get_json()

        assert response.status_code == 404
        assert data["error"] is not None

    @pytest.mark.asyncio
    async def test_delete_connection_with_triggers_blocked(self, auth_client, setup_db):
        """Test deleting a connection that has triggers referencing it."""
        connection = await create_sample_connection(setup_db)
        template = await create_sample_template(setup_db)
        
        # Create a trigger referencing the connection
        AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            trigger = Trigger(
                template_id=template.id,
                connection_id=connection.id,
                name="Test Trigger"
            )
            session.add(trigger)
            await session.commit()

        response = await auth_client.delete(f"/api/connections/{connection.id}")
        data = await response.get_json()

        assert response.status_code == 409
        assert data["error"] is not None
        assert "trigger" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_test_connection_endpoint(self, auth_client, setup_db):
        """Test the test connection endpoint."""
        connection = await create_sample_connection(setup_db)
        
        # Create mock response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='{"status": "ok"}')
        
        # Create a mock context manager for the request
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
            response = await auth_client.post(f"/api/connections/{connection.id}/test")
            data = await response.get_json()

            assert response.status_code == 200
            assert data["data"]["response_status"] == 200

    @pytest.mark.asyncio
    async def test_test_connection_endpoint_failure(self, auth_client, setup_db):
        """Test the test connection endpoint when request fails."""
        connection = await create_sample_connection(setup_db)
        
        # Create a mock context manager that raises an exception
        class MockRequestContextManager:
            def __init__(self, *args, **kwargs):
                pass
            async def __aenter__(self):
                raise Exception("Connection failed")
            async def __aexit__(self, *args):
                return None
        
        mock_session = AsyncMock()
        mock_session.request = MockRequestContextManager
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        
        with patch("aiohttp.ClientSession", return_value=mock_session):
            response = await auth_client.post(f"/api/connections/{connection.id}/test")
            data = await response.get_json()

            assert response.status_code == 400
            assert data["error"] is not None

    @pytest.mark.asyncio
    async def test_test_connection_not_found(self, auth_client):
        """Test the test endpoint for non-existent connection."""
        response = await auth_client.post("/api/connections/999/test")
        data = await response.get_json()

        assert response.status_code == 404
        assert data["error"] is not None


class TestConnectionEncryption:
    """Tests for connection header encryption."""

    @pytest.mark.asyncio
    async def test_encrypted_values_stored_encrypted(self, auth_client, setup_db):
        """Test that encrypted header values are stored encrypted."""
        plain_value = "my_secret_token"
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "Encrypted Test",
                "endpoint": "https://api.example.com",
                "method": "POST",
                "headers": [{"key": "Auth", "value": plain_value, "encrypted": True}]
            }
        )
        data = await response.get_json()
        assert response.status_code == 201

        # Get the connection from DB directly
        AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Connection).where(Connection.id == data["data"]["id"])
            )
            connection = result.scalar_one()

            stored_header = connection.headers[0]
            assert stored_header["value"] != plain_value
            decrypted = config.decrypt_credential(stored_header["value"])
            assert decrypted == plain_value

    @pytest.mark.asyncio
    async def test_non_encrypted_values_stored_plain(self, auth_client, setup_db):
        """Test that non-encrypted header values are stored as plain text."""
        plain_value = "public_value"
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "Plain Test",
                "endpoint": "https://api.example.com",
                "method": "POST",
                "headers": [{"key": "X-Public", "value": plain_value, "encrypted": False}]
            }
        )
        data = await response.get_json()
        assert response.status_code == 201

        AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Connection).where(Connection.id == data["data"]["id"])
            )
            connection = result.scalar_one()

            stored_header = connection.headers[0]
            assert stored_header["value"] == plain_value

    @pytest.mark.asyncio
    async def test_masked_values_never_returned(self, auth_client, setup_db):
        """Test that encrypted values are never returned in plain text."""
        connection = await create_sample_connection(setup_db)
        
        response = await auth_client.get(f"/api/connections/{connection.id}")
        data = await response.get_json()

        encrypted_header = next((h for h in data["data"]["headers"] if h["encrypted"]), None)
        assert encrypted_header is not None
        assert encrypted_header["value"] == "••••••"
        assert encrypted_header["value"] != "secret_token"

        response = await auth_client.get("/api/connections")
        data = await response.get_json()

        encrypted_header = next((h for h in data["data"][0]["headers"] if h["encrypted"]), None)
        assert encrypted_header is not None
        assert encrypted_header["value"] == "••••••"


class TestConnectionFields:
    """Tests for connection fields functionality."""

    @pytest.mark.asyncio
    async def test_create_connection_with_fields(self, auth_client):
        """Test creating a connection with payload fields."""
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "Payment Webhook",
                "endpoint": "https://api.example.com/webhook",
                "method": "POST",
                "fields": [
                    {"name": "from_account.bank_account_id", "type": "string", "required": True},
                    {"name": "amount", "type": "number", "required": True},
                    {"name": "narration", "type": "string", "required": False}
                ]
            }
        )
        data = await response.get_json()

        assert response.status_code == 201
        assert data["error"] is None
        assert len(data["data"]["fields"]) == 3
        assert data["data"]["fields"][0]["name"] == "from_account.bank_account_id"
        assert data["data"]["fields"][0]["type"] == "string"
        assert data["data"]["fields"][0]["required"] is True
        assert data["data"]["fields"][1]["name"] == "amount"
        assert data["data"]["fields"][1]["type"] == "number"
        assert data["data"]["fields"][2]["required"] is False

    @pytest.mark.asyncio
    async def test_create_connection_fields_defaults(self, auth_client):
        """Test that field defaults are applied correctly."""
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "Default Fields",
                "endpoint": "https://api.example.com/webhook",
                "fields": [
                    {"name": "simple_field"}  # only name provided
                ]
            }
        )
        data = await response.get_json()

        assert response.status_code == 201
        assert data["data"]["fields"][0]["type"] == "string"  # default type
        assert data["data"]["fields"][0]["required"] is False  # default required

    @pytest.mark.asyncio
    async def test_create_connection_invalid_fields_type(self, auth_client):
        """Test validation rejects fields that is not an array."""
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "Bad Fields",
                "endpoint": "https://api.example.com/webhook",
                "fields": {"name": "invalid"}  # dict instead of array
            }
        )
        data = await response.get_json()

        assert response.status_code == 400
        assert "fields must be an array" in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_create_connection_field_missing_name(self, auth_client):
        """Test validation rejects field without name."""
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "Missing Name",
                "endpoint": "https://api.example.com/webhook",
                "fields": [{"type": "string"}]  # no name
            }
        )
        data = await response.get_json()

        assert response.status_code == 400
        assert "name" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_create_connection_invalid_field_type(self, auth_client):
        """Test validation rejects invalid field type."""
        response = await auth_client.post(
            "/api/connections",
            json={
                "name": "Bad Type",
                "endpoint": "https://api.example.com/webhook",
                "fields": [{"name": "field", "type": "invalid_type"}]
            }
        )
        data = await response.get_json()

        assert response.status_code == 400
        assert "type" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_update_connection_fields(self, auth_client, setup_db):
        """Test updating connection fields."""
        connection = await create_sample_connection(setup_db)

        response = await auth_client.put(
            f"/api/connections/{connection.id}",
            json={
                "fields": [
                    {"name": "updated_field", "type": "number", "required": True}
                ]
            }
        )
        data = await response.get_json()

        assert response.status_code == 200
        assert len(data["data"]["fields"]) == 1
        assert data["data"]["fields"][0]["name"] == "updated_field"
        assert data["data"]["fields"][0]["type"] == "number"
        assert data["data"]["fields"][0]["required"] is True

    @pytest.mark.asyncio
    async def test_get_connection_includes_fields(self, auth_client, setup_db):
        """Test that GET returns fields."""
        AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            connection = Connection(
                name="Fields Test",
                endpoint="https://api.example.com",
                method="POST",
                headers=[],
                fields=[
                    {"name": "account_id", "type": "string", "required": True},
                    {"name": "value", "type": "number", "required": True}
                ]
            )
            session.add(connection)
            await session.commit()
            await session.refresh(connection)

        response = await auth_client.get(f"/api/connections/{connection.id}")
        data = await response.get_json()

        assert response.status_code == 200
        assert len(data["data"]["fields"]) == 2
        assert data["data"]["fields"][0]["name"] == "account_id"
        assert data["data"]["fields"][1]["name"] == "value"

    @pytest.mark.asyncio
    async def test_list_connections_includes_fields(self, auth_client, setup_db):
        """Test that list returns fields for each connection."""
        AsyncSessionLocal = async_sessionmaker(setup_db, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            connection = Connection(
                name="List Fields Test",
                endpoint="https://api.example.com",
                method="POST",
                headers=[],
                fields=[{"name": "test_field", "type": "boolean", "required": False}]
            )
            session.add(connection)
            await session.commit()
            await session.refresh(connection)

        response = await auth_client.get("/api/connections")
        data = await response.get_json()

        assert response.status_code == 200
        found = next((c for c in data["data"] if c["name"] == "List Fields Test"), None)
        assert found is not None
        assert len(found["fields"]) == 1
        assert found["fields"][0]["type"] == "boolean"