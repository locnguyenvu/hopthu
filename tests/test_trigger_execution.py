"""Tests for trigger execution functions."""

import os
import tempfile
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from quart import Quart
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from hopthu.app.models import Base, Account, Mailbox, Email, Template, EmailData, Connection, Trigger, TriggerLog, EMAIL_STATUS_EXTRACTED
from hopthu.app.services.trigger import execute_trigger, run_triggers_for_email
from hopthu.app import config


@pytest_asyncio.fixture
async def db_engine():
    """Create an in-memory database engine."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    from sqlalchemy import event

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def sample_data(db_engine):
    """Create sample data for testing."""
    AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
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

        # Create email
        email = Email(
            account_id=account.id,
            mailbox_id=mailbox.id,
            from_email="sender@example.com",
            subject="Payment Received",
            content_type="text/plain",
            body="You received 500000 VND",
            message_id="<msg123@example.com>",
            status=EMAIL_STATUS_EXTRACTED,
            received_at=datetime(2026, 4, 9, 10, 0, 0)
        )
        session.add(email)
        await session.flush()

        # Create template
        template = Template(
            from_email="sender@example.com",
            subject="Payment Received",
            content_type="text/plain",
            template="You received {{amount}} VND",
            fields=["amount"]
        )
        session.add(template)
        await session.flush()

        # Create email data
        email_data = EmailData(
            email_id=email.id,
            template_id=template.id,
            data={
                "meta_data": {"received_at": "2026-04-09T10:00:00+07:00"},
                "extracted_data": {"amount": "500000"}
            }
        )
        session.add(email_data)
        await session.flush()

        # Create connection
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
        await session.flush()

        # Create trigger
        trigger = Trigger(
            template_id=template.id,
            connection_id=connection.id,
            name="Payment Trigger",
            is_active=True,
            field_mappings=[
                {"source": "$extracted_data.amount", "target": "payment.amount"},
                {"source": "$email.received_at", "target": "payment.date"}
            ]
        )
        session.add(trigger)
        await session.commit()

        return {
            "email": email,
            "template": template,
            "email_data": email_data,
            "connection": connection,
            "trigger": trigger
        }


class TestExecuteTrigger:
    """Tests for execute_trigger function."""

    @pytest.mark.asyncio
    async def test_execute_trigger_success(self, db_engine, sample_data):
        """Test successful trigger execution."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            # Fetch objects to ensure they're attached to session
            result = await session.execute(select(Trigger).where(Trigger.id == sample_data["trigger"].id))
            trigger = result.scalar_one()
            result = await session.execute(select(EmailData).where(EmailData.id == sample_data["email_data"].id))
            email_data = result.scalar_one()
            result = await session.execute(select(Email).where(Email.id == sample_data["email"].id))
            email = result.scalar_one()

        # Mock aiohttp
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='{"status": "ok"}')
        
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
            with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
                log = await execute_trigger(trigger, email_data, email)

        assert log.status == "success"
        assert log.response_status == 200
        assert log.request_url == "https://api.example.com/webhook"
        assert log.request_method == "POST"
        assert log.request_body == {"payment": {"amount": "500000", "date": "2026-04-09T10:00:00"}}
        # Headers should be masked
        assert log.request_headers.get("Authorization") == "••••••"
        assert log.request_headers.get("Content-Type") == "application/json"

    @pytest.mark.asyncio
    async def test_execute_trigger_failed_request(self, db_engine, sample_data):
        """Test trigger execution with failed request."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Trigger).where(Trigger.id == sample_data["trigger"].id))
            trigger = result.scalar_one()
            result = await session.execute(select(EmailData).where(EmailData.id == sample_data["email_data"].id))
            email_data = result.scalar_one()
            result = await session.execute(select(Email).where(Email.id == sample_data["email"].id))
            email = result.scalar_one()

        # Mock aiohttp to return error
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_response.text = AsyncMock(return_value='{"error": "Internal Server Error"}')
        
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
            with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
                log = await execute_trigger(trigger, email_data, email)

        assert log.status == "failed"
        assert log.response_status == 500

    @pytest.mark.asyncio
    async def test_execute_trigger_connection_error(self, db_engine, sample_data):
        """Test trigger execution with connection error."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Trigger).where(Trigger.id == sample_data["trigger"].id))
            trigger = result.scalar_one()
            result = await session.execute(select(EmailData).where(EmailData.id == sample_data["email_data"].id))
            email_data = result.scalar_one()
            result = await session.execute(select(Email).where(Email.id == sample_data["email"].id))
            email = result.scalar_one()

        # Mock aiohttp to raise exception
        class MockRequestContextManager:
            def __init__(self, *args, **kwargs):
                pass
            async def __aenter__(self):
                raise Exception("Connection refused")
            async def __aexit__(self, *args):
                return None
        
        mock_session = AsyncMock()
        mock_session.request = MockRequestContextManager
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)

        with patch("aiohttp.ClientSession", return_value=mock_session):
            with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
                log = await execute_trigger(trigger, email_data, email)

        assert log.status == "failed"
        assert log.response_status is None
        assert "Connection refused" in log.response_body

    @pytest.mark.asyncio
    async def test_execute_trigger_masks_encrypted_headers(self, db_engine, sample_data):
        """Test that encrypted header values are masked in log."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Trigger).where(Trigger.id == sample_data["trigger"].id))
            trigger = result.scalar_one()
            result = await session.execute(select(EmailData).where(EmailData.id == sample_data["email_data"].id))
            email_data = result.scalar_one()
            result = await session.execute(select(Email).where(Email.id == sample_data["email"].id))
            email = result.scalar_one()

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='ok')
        
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
            with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
                log = await execute_trigger(trigger, email_data, email)

        # Verify encrypted header is masked in log
        assert log.request_headers.get("Authorization") == "••••••"
        # Non-encrypted header should show value
        assert log.request_headers.get("Content-Type") == "application/json"


class TestRunTriggersForEmail:
    """Tests for run_triggers_for_email function."""

    @pytest.mark.asyncio
    async def test_run_triggers_for_email(self, db_engine, sample_data):
        """Test running triggers for an email."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='ok')
        
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
            with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
                logs = await run_triggers_for_email(sample_data["email"].id)

        assert len(logs) == 1
        assert logs[0].status == "success"

    @pytest.mark.asyncio
    async def test_run_triggers_skips_inactive(self, db_engine, sample_data):
        """Test that inactive triggers are skipped."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
        
        # Set trigger to inactive
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Trigger).where(Trigger.id == sample_data["trigger"].id))
            trigger = result.scalar_one()
            trigger.is_active = False
            await session.commit()

        with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
            logs = await run_triggers_for_email(sample_data["email"].id)

        assert len(logs) == 0

    @pytest.mark.asyncio
    async def test_run_triggers_no_email(self, db_engine):
        """Test running triggers for non-existent email."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
        
        with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
            logs = await run_triggers_for_email(999)

        assert len(logs) == 0

    @pytest.mark.asyncio
    async def test_run_triggers_no_email_data(self, db_engine, sample_data):
        """Test running triggers when email has no extracted data."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
        
        # Delete email data
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(EmailData).where(EmailData.email_id == sample_data["email"].id))
            email_data = result.scalar_one_or_none()
            if email_data:
                await session.delete(email_data)
                await session.commit()

        with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
            logs = await run_triggers_for_email(sample_data["email"].id)

        assert len(logs) == 0

    @pytest.mark.asyncio
    async def test_multiple_triggers_same_connection(self, db_engine, sample_data):
        """Test that multiple triggers can share the same connection."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
        
        # Create another trigger with same connection
        async with AsyncSessionLocal() as session:
            trigger2 = Trigger(
                template_id=sample_data["template"].id,
                connection_id=sample_data["connection"].id,
                name="Second Trigger",
                is_active=True,
                field_mappings=[
                    {"source": "$extracted_data.amount", "target": "txn.value"}
                ]
            )
            session.add(trigger2)
            await session.commit()

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='ok')
        
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
            with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
                logs = await run_triggers_for_email(sample_data["email"].id)

        assert len(logs) == 2
        assert all(log.status == "success" for log in logs)