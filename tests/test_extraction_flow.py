"""Integration tests for extraction flow with triggers."""

import os
import tempfile
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from hopthu.app.models import (
    Base, Account, Mailbox, Email, Template, EmailData, Connection, Trigger, TriggerLog,
    EMAIL_STATUS_NEW
)
from hopthu.app.services.parser import process_email
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
    """Create sample data for integration testing."""
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
            from_email="bank@example.com",
            subject="Payment Notification",
            content_type="text/plain",
            body="Amount: 500000 VND",
            message_id="<msg123@example.com>",
            status=EMAIL_STATUS_NEW,
            received_at=datetime(2026, 4, 9, 10, 0, 0)
        )
        session.add(email)
        await session.flush()

        # Create template
        template = Template(
            from_email="bank@example.com",
            subject=None,  # catch-all for this sender
            content_type="text/plain",
            template="Amount: {{amount}} VND",
            fields=[{"name": "amount"}]
        )
        session.add(template)
        await session.flush()

        # Create connection
        connection = Connection(
            name="Payment Webhook",
            endpoint="https://api.example.com/payment",
            method="POST",
            headers=[
                {"key": "Content-Type", "value": "application/json", "encrypted": False},
                {"key": "X-API-Key", "value": config.encrypt_credential("api_key_123"), "encrypted": True}
            ]
        )
        session.add(connection)
        await session.flush()

        # Create trigger
        trigger = Trigger(
            template_id=template.id,
            connection_id=connection.id,
            name="Payment Notification Trigger",
            is_active=True,
            field_mappings=[
                {"source": "$extracted_data.amount", "target": "transaction.value"},
                {"source": "$email.received_at", "target": "transaction.timestamp"}
            ]
        )
        session.add(trigger)
        await session.commit()

        return {
            "email_id": email.id,
            "template_id": template.id,
            "connection_id": connection.id,
            "trigger_id": trigger.id
        }


class TestExtractionFlowWithTriggers:
    """Integration tests for extraction flow with triggers."""

    @pytest.mark.asyncio
    async def test_extraction_fires_trigger(self, db_engine, sample_data):
        """Test that successful extraction fires triggers."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)

        # Mock HTTP request
        mock_response = AsyncMock()
        mock_response.status = 201
        mock_response.text = AsyncMock(return_value='{"created": true}')
        
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

        # Need to patch both modules' imports of AsyncSession
        with patch("aiohttp.ClientSession", return_value=mock_session):
            with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
                with patch("hopthu.app.services.parser.AsyncSession", AsyncSessionLocal):
                    result = await process_email(sample_data["email_id"])

        # Verify extraction succeeded
        assert result.get("success") is True

        # Verify trigger log was created
        async with AsyncSessionLocal() as session:
            log_result = await session.execute(
                select(TriggerLog).where(TriggerLog.email_id == sample_data["email_id"])
            )
            logs = log_result.scalars().all()

        assert len(logs) == 1
        assert logs[0].status == "success"
        assert logs[0].response_status == 201
        assert logs[0].request_body == {
            "transaction": {
                "value": "500000",
                "timestamp": "2026-04-09T10:00:00"
            }
        }

    @pytest.mark.asyncio
    async def test_no_triggers_on_extraction_failure(self, db_engine, sample_data):
        """Test that triggers don't fire when extraction fails."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)

        # Create email with content that won't match template
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Email).where(Email.id == sample_data["email_id"]))
            email = result.scalar_one()
            email.body = "This content does not match the template"
            await session.commit()

        with patch("hopthu.app.services.parser.AsyncSession", AsyncSessionLocal):
            result = await process_email(sample_data["email_id"])

        # Verify extraction failed
        assert "error" in result

        # Verify no trigger log was created
        async with AsyncSessionLocal() as session:
            log_result = await session.execute(
                select(TriggerLog).where(TriggerLog.email_id == sample_data["email_id"])
            )
            logs = log_result.scalars().all()

        assert len(logs) == 0

    @pytest.mark.asyncio
    async def test_inactive_trigger_not_fired(self, db_engine, sample_data):
        """Test that inactive triggers are not fired."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)

        # Set trigger to inactive
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Trigger).where(Trigger.id == sample_data["trigger_id"]))
            trigger = result.scalar_one()
            trigger.is_active = False
            await session.commit()

        with patch("hopthu.app.services.trigger.AsyncSession", AsyncSessionLocal):
            with patch("hopthu.app.services.parser.AsyncSession", AsyncSessionLocal):
                result = await process_email(sample_data["email_id"])

        # Verify extraction succeeded
        assert result.get("success") is True

        # Verify no trigger log was created
        async with AsyncSessionLocal() as session:
            log_result = await session.execute(
                select(TriggerLog).where(TriggerLog.email_id == sample_data["email_id"])
            )
            logs = log_result.scalars().all()

        assert len(logs) == 0

    @pytest.mark.asyncio
    async def test_two_triggers_same_connection(self, db_engine, sample_data):
        """Test that two triggers sharing the same connection both work."""
        AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)

        # Create second trigger with same connection
        async with AsyncSessionLocal() as session:
            trigger2 = Trigger(
                template_id=sample_data["template_id"],
                connection_id=sample_data["connection_id"],
                name="Second Payment Trigger",
                is_active=True,
                field_mappings=[
                    {"source": "$extracted_data.amount", "target": "payment.amt"}
                ]
            )
            session.add(trigger2)
            await session.commit()

        # Mock HTTP request
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
                with patch("hopthu.app.services.parser.AsyncSession", AsyncSessionLocal):
                    result = await process_email(sample_data["email_id"])

        # Verify extraction succeeded
        assert result.get("success") is True

        # Verify two trigger logs were created
        async with AsyncSessionLocal() as session:
            log_result = await session.execute(
                select(TriggerLog).where(TriggerLog.email_id == sample_data["email_id"])
            )
            logs = log_result.scalars().all()

        assert len(logs) == 2
        assert all(log.status == "success" for log in logs)