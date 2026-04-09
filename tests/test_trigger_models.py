"""Tests for Connection, Trigger, and TriggerLog models."""

import os
import tempfile
from datetime import datetime

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.exc import IntegrityError

from hopthu.app.models import Base, Account, Mailbox, Email, Template, EmailData
from hopthu.app.models import Connection, Trigger, TriggerLog, EMAIL_STATUS_NEW


@pytest_asyncio.fixture
async def db_session():
    """Create a temporary database for testing."""
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")

    # Enable foreign keys via event listener (like production)
    from sqlalchemy import event
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSession = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSession() as session:
        yield session

    await engine.dispose()
    os.unlink(db_path)


@pytest_asyncio.fixture
async def sample_data(db_session):
    """Create sample account, mailbox, email, and template for testing."""
    # Create account
    account = Account(
        email="test@example.com",
        host="imap.example.com",
        port=993,
        credential="encrypted_password"
    )
    db_session.add(account)
    await db_session.flush()

    # Create mailbox
    mailbox = Mailbox(
        account_id=account.id,
        name="INBOX",
        is_active=True
    )
    db_session.add(mailbox)
    await db_session.flush()

    # Create email
    email = Email(
        account_id=account.id,
        mailbox_id=mailbox.id,
        from_email="sender@example.com",
        to_email="test@example.com",
        subject="Test Subject",
        content_type="text/plain",
        body="Test body",
        message_id="<test123@example.com>",
        status=EMAIL_STATUS_NEW,
        received_at=datetime(2024, 1, 1, 0, 0, 0)
    )
    db_session.add(email)
    await db_session.flush()

    # Create template
    template = Template(
        from_email="sender@example.com",
        subject="Test Subject",
        content_type="text/plain",
        template="Hello {{name}}",
        fields=["name"]
    )
    db_session.add(template)
    await db_session.flush()

    return {
        "account": account,
        "mailbox": mailbox,
        "email": email,
        "template": template
    }


class TestConnectionModel:
    """Tests for Connection model."""

    @pytest.mark.asyncio
    async def test_connection_table_exists(self, db_session):
        """Test that connections table exists."""
        async with db_session.bind.connect() as conn:
            result = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='connections'")
            )
            row = result.fetchone()
            assert row is not None, "connections table should exist"

    @pytest.mark.asyncio
    async def test_create_connection(self, db_session):
        """Test creating a connection."""
        connection = Connection(
            name="Webhook API",
            endpoint="https://api.example.com/webhook",
            method="POST",
            headers=[
                {"key": "Content-Type", "value": "application/json", "encrypted": False},
                {"key": "Authorization", "value": "encrypted_token_here", "encrypted": True}
            ]
        )
        db_session.add(connection)
        await db_session.commit()

        assert connection.id is not None
        assert connection.name == "Webhook API"
        assert connection.endpoint == "https://api.example.com/webhook"
        assert connection.method == "POST"
        assert len(connection.headers) == 2
        assert connection.created_at is not None
        assert connection.updated_at is not None

    @pytest.mark.asyncio
    async def test_connection_unique_name(self, db_session):
        """Test that connection names must be unique."""
        conn1 = Connection(name="API", endpoint="https://api1.example.com", method="POST")
        db_session.add(conn1)
        await db_session.commit()

        conn2 = Connection(name="API", endpoint="https://api2.example.com", method="GET")
        db_session.add(conn2)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    @pytest.mark.asyncio
    async def test_connection_default_method(self, db_session):
        """Test that POST is the default method."""
        connection = Connection(
            name="Default Method API",
            endpoint="https://api.example.com/webhook"
        )
        db_session.add(connection)
        await db_session.commit()

        assert connection.method == "POST"

    @pytest.mark.asyncio
    async def test_connection_default_headers(self, db_session):
        """Test default headers is an empty list."""
        connection = Connection(
            name="No Headers API",
            endpoint="https://api.example.com/webhook",
            method="GET"
        )
        db_session.add(connection)
        await db_session.commit()

        assert connection.headers == []


class TestTriggerModel:
    """Tests for Trigger model."""

    @pytest.mark.asyncio
    async def test_trigger_table_exists(self, db_session):
        """Test that triggers table exists."""
        async with db_session.bind.connect() as conn:
            result = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='triggers'")
            )
            row = result.fetchone()
            assert row is not None, "triggers table should exist"

    @pytest.mark.asyncio
    async def test_create_trigger(self, db_session, sample_data):
        """Test creating a trigger."""
        # First create a connection
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Payment Trigger",
            is_active=True,
            field_mappings=[
                {"source": "$extracted_data.amount", "target": "payment.amount"},
                {"source": "$email.received_at", "target": "payment.date"}
            ]
        )
        db_session.add(trigger)
        await db_session.commit()

        assert trigger.id is not None
        assert trigger.name == "Payment Trigger"
        assert trigger.is_active is True
        assert trigger.template_id == sample_data["template"].id
        assert trigger.connection_id == connection.id

    @pytest.mark.asyncio
    async def test_trigger_template_fk(self, db_session, sample_data):
        """Test that trigger.template_id references templates.id."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        # Try to create trigger with non-existent template_id
        trigger = Trigger(
            template_id=9999,  # non-existent
            connection_id=connection.id,
            name="Invalid Trigger"
        )
        db_session.add(trigger)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    @pytest.mark.asyncio
    async def test_trigger_connection_fk(self, db_session, sample_data):
        """Test that trigger.connection_id references connections.id."""
        # Try to create trigger with non-existent connection_id
        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=9999,  # non-existent
            name="Invalid Trigger"
        )
        db_session.add(trigger)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    @pytest.mark.asyncio
    async def test_trigger_defaults(self, db_session, sample_data):
        """Test trigger default values."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Default Trigger"
        )
        db_session.add(trigger)
        await db_session.commit()

        assert trigger.is_active is True
        assert trigger.field_mappings == []

    @pytest.mark.asyncio
    async def test_trigger_relationships(self, db_session, sample_data):
        """Test trigger relationships to template and connection."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Relationship Trigger"
        )
        db_session.add(trigger)
        await db_session.commit()

        # Refresh to load relationships
        await db_session.refresh(trigger)

        assert trigger.template.id == sample_data["template"].id
        assert trigger.connection.id == connection.id

        # Verify relationships work by querying from the other side
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        result = await db_session.execute(
            select(Template).where(Template.id == sample_data["template"].id).options(selectinload(Template.triggers))
        )
        template_with_triggers = result.scalar_one()
        assert len(template_with_triggers.triggers) == 1
        assert template_with_triggers.triggers[0].id == trigger.id

        result = await db_session.execute(
            select(Connection).where(Connection.id == connection.id).options(selectinload(Connection.triggers))
        )
        connection_with_triggers = result.scalar_one()
        assert len(connection_with_triggers.triggers) == 1
        assert connection_with_triggers.triggers[0].id == trigger.id


class TestTriggerLogModel:
    """Tests for TriggerLog model."""

    @pytest.mark.asyncio
    async def test_trigger_log_table_exists(self, db_session):
        """Test that trigger_logs table exists."""
        async with db_session.bind.connect() as conn:
            result = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='trigger_logs'")
            )
            row = result.fetchone()
            assert row is not None, "trigger_logs table should exist"

    @pytest.mark.asyncio
    async def test_create_trigger_log(self, db_session, sample_data):
        """Test creating a trigger log."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Test Trigger"
        )
        db_session.add(trigger)
        await db_session.flush()

        log = TriggerLog(
            trigger_id=trigger.id,
            email_id=sample_data["email"].id,
            request_url="https://api.example.com/webhook",
            request_method="POST",
            request_headers={"Content-Type": "application/json", "Authorization": "••••••"},
            request_body={"payment": {"amount": "100"}},
            response_status=200,
            response_body='{"status": "ok"}',
            status="success",
            executed_at=datetime.utcnow()
        )
        db_session.add(log)
        await db_session.commit()

        assert log.id is not None
        assert log.status == "success"
        assert log.response_status == 200
        assert log.executed_at is not None

    @pytest.mark.asyncio
    async def test_trigger_log_trigger_fk(self, db_session, sample_data):
        """Test that trigger_log.trigger_id references triggers.id."""
        log = TriggerLog(
            trigger_id=9999,  # non-existent
            email_id=sample_data["email"].id,
            request_url="https://api.example.com/webhook",
            request_method="POST",
            status="pending"
        )
        db_session.add(log)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    @pytest.mark.asyncio
    async def test_trigger_log_email_fk(self, db_session, sample_data):
        """Test that trigger_log.email_id references emails.id."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Test Trigger"
        )
        db_session.add(trigger)
        await db_session.flush()

        log = TriggerLog(
            trigger_id=trigger.id,
            email_id=9999,  # non-existent
            request_url="https://api.example.com/webhook",
            request_method="POST",
            status="pending"
        )
        db_session.add(log)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    @pytest.mark.asyncio
    async def test_trigger_log_defaults(self, db_session, sample_data):
        """Test trigger log default values."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Test Trigger"
        )
        db_session.add(trigger)
        await db_session.flush()

        log = TriggerLog(
            trigger_id=trigger.id,
            email_id=sample_data["email"].id,
            request_url="https://api.example.com/webhook",
            request_method="POST"
        )
        db_session.add(log)
        await db_session.commit()

        assert log.status == "pending"
        assert log.request_headers == {}
        assert log.request_body == {}

    @pytest.mark.asyncio
    async def test_trigger_log_relationships(self, db_session, sample_data):
        """Test trigger log relationships."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Test Trigger"
        )
        db_session.add(trigger)
        await db_session.flush()

        log = TriggerLog(
            trigger_id=trigger.id,
            email_id=sample_data["email"].id,
            request_url="https://api.example.com/webhook",
            request_method="POST",
            status="success"
        )
        db_session.add(log)
        await db_session.commit()

        await db_session.refresh(log)

        assert log.trigger == trigger
        assert log.email == sample_data["email"]


class TestCascadeDelete:
    """Tests for cascade delete behavior."""

    @pytest.mark.asyncio
    async def test_delete_connection_cascades_to_triggers(self, db_session, sample_data):
        """Test that deleting a connection deletes its triggers."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Test Trigger"
        )
        db_session.add(trigger)
        await db_session.commit()
        trigger_id = trigger.id

        # Delete connection
        await db_session.delete(connection)
        await db_session.commit()

        # Verify trigger is deleted
        from sqlalchemy import select
        result = await db_session.execute(
            select(Trigger).where(Trigger.id == trigger_id)
        )
        assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_delete_template_cascades_to_triggers(self, db_session, sample_data):
        """Test that deleting a template deletes its triggers."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Test Trigger"
        )
        db_session.add(trigger)
        await db_session.commit()
        trigger_id = trigger.id

        # Delete template
        await db_session.delete(sample_data["template"])
        await db_session.commit()

        # Verify trigger is deleted
        from sqlalchemy import select
        result = await db_session.execute(
            select(Trigger).where(Trigger.id == trigger_id)
        )
        assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_delete_trigger_cascades_to_logs(self, db_session, sample_data):
        """Test that deleting a trigger deletes its logs."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Test Trigger"
        )
        db_session.add(trigger)
        await db_session.flush()

        log = TriggerLog(
            trigger_id=trigger.id,
            email_id=sample_data["email"].id,
            request_url="https://api.example.com/webhook",
            request_method="POST",
            status="success"
        )
        db_session.add(log)
        await db_session.commit()
        log_id = log.id

        # Delete trigger
        await db_session.delete(trigger)
        await db_session.commit()

        # Verify log is deleted
        from sqlalchemy import select
        result = await db_session.execute(
            select(TriggerLog).where(TriggerLog.id == log_id)
        )
        assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_delete_email_cascades_to_logs(self, db_session, sample_data):
        """Test that deleting an email deletes its trigger logs."""
        connection = Connection(
            name="Test Connection",
            endpoint="https://api.example.com/webhook",
            method="POST"
        )
        db_session.add(connection)
        await db_session.flush()

        trigger = Trigger(
            template_id=sample_data["template"].id,
            connection_id=connection.id,
            name="Test Trigger"
        )
        db_session.add(trigger)
        await db_session.flush()

        log = TriggerLog(
            trigger_id=trigger.id,
            email_id=sample_data["email"].id,
            request_url="https://api.example.com/webhook",
            request_method="POST",
            status="success"
        )
        db_session.add(log)
        await db_session.commit()
        log_id = log.id

        # Delete email
        await db_session.delete(sample_data["email"])
        await db_session.commit()

        # Verify log is deleted
        from sqlalchemy import select
        result = await db_session.execute(
            select(TriggerLog).where(TriggerLog.id == log_id)
        )
        assert result.scalar_one_or_none() is None