"""SQLAlchemy ORM models for the email client."""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import DeclarativeBase, relationship


# Email status constants
EMAIL_STATUS_NEW = "new"
EMAIL_STATUS_EXTRACTED = "extracted"
EMAIL_STATUS_IGNORED = "ignored"
EMAIL_STATUS_PUSHED = "pushed"


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


class Account(Base):
    """IMAP email account."""

    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, unique=True)
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=False, default=993)
    is_ssl = Column(Boolean, nullable=False, default=True)
    authenticated_method = Column(String, nullable=False, default="password")
    credential = Column(String, nullable=False)  # encrypted password
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    mailboxes = relationship(
        "Mailbox", back_populates="account", cascade="all, delete-orphan"
    )
    emails = relationship(
        "Email", back_populates="account", cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Convert to dictionary (excludes credential)."""
        return {
            "id": self.id,
            "email": self.email,
            "host": self.host,
            "port": self.port,
            "is_ssl": self.is_ssl,
            "authenticated_method": self.authenticated_method,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Mailbox(Base):
    """Mailbox/folder within an IMAP account."""

    __tablename__ = "mailboxes"
    __table_args__ = (UniqueConstraint("account_id", "name"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    account = relationship("Account", back_populates="mailboxes")
    emails = relationship(
        "Email", back_populates="mailbox", cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "account_id": self.account_id,
            "name": self.name,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Email(Base):
    """Email message synced from IMAP."""

    __tablename__ = "emails"
    __table_args__ = (
        UniqueConstraint("account_id", "message_id"),  # deduplicate by Message-ID
        Index("idx_emails_status", "status"),
        Index("idx_emails_from", "from_email"),
        Index("idx_emails_received", "received_at"),
        Index("idx_emails_account_mailbox", "account_id", "mailbox_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    mailbox_id = Column(
        Integer, ForeignKey("mailboxes.id", ondelete="CASCADE"), nullable=False
    )
    from_email = Column(String, nullable=False)
    to_email = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    content_type = Column(String, nullable=False)  # 'text/plain' or 'text/html'
    body = Column(Text, nullable=True)
    message_id = Column(String, nullable=False)  # extracted from Message-ID header
    meta_data = Column(JSON, nullable=False, default=dict)  # additional headers
    status = Column(
        String, nullable=False, default=EMAIL_STATUS_NEW
    )  # new | extracted | ignored | pushed
    received_at = Column(
        DateTime, nullable=False
    )  # from IMAP server, stored in app timezone
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    account = relationship("Account", back_populates="emails")
    mailbox = relationship("Mailbox", back_populates="emails")
    email_data = relationship(
        "EmailData", back_populates="email", uselist=False, cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "account_id": self.account_id,
            "mailbox_id": self.mailbox_id,
            "from_email": self.from_email,
            "to_email": self.to_email,
            "subject": self.subject,
            "content_type": self.content_type,
            "message_id": self.message_id,
            "meta_data": self.meta_data,
            "status": self.status,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Template(Base):
    """Template for parsing email content."""

    __tablename__ = "templates"
    __table_args__ = (Index("idx_templates_from", "from_email"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_email = Column(String, nullable=False)
    subject = Column(String, nullable=True)  # NULL = match any subject from this sender
    content_type = Column(String, nullable=False)
    template = Column(Text, nullable=False)  # template body with variable markers
    fields = Column(JSON, nullable=False, default=list)  # list of variable names
    priority = Column(Integer, nullable=True)  # NULL = auto-order
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    email_data = relationship(
        "EmailData", back_populates="template", cascade="all, delete-orphan"
    )
    triggers = relationship(
        "Trigger", back_populates="template", cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "from_email": self.from_email,
            "subject": self.subject,
            "content_type": self.content_type,
            "fields": self.fields,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class EmailData(Base):
    """Extracted data from email using template."""

    __tablename__ = "email_data"
    __table_args__ = (UniqueConstraint("email_id"),)  # one extraction per email

    id = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(
        Integer, ForeignKey("emails.id", ondelete="CASCADE"), nullable=False
    )
    template_id = Column(
        Integer, ForeignKey("templates.id", ondelete="CASCADE"), nullable=False
    )
    data = Column(
        JSON, nullable=False, default=dict
    )  # { meta_data: {...}, extracted_data: {...} }
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    email = relationship("Email", back_populates="email_data")
    template = relationship("Template")

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "email_id": self.email_id,
            "template_id": self.template_id,
            "data": self.data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Connection(Base):
    """External API connection for triggers."""

    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    endpoint = Column(String, nullable=False)  # URL to send request to
    method = Column(String, nullable=False, default="POST")  # POST | GET | PUT
    headers = Column(
        JSON, nullable=False, default=list
    )  # [{ "key": "...", "value": "...", "encrypted": false }]
    fields = Column(
        JSON, nullable=False, default=list
    )  # [{ "name": "amount", "type": "number", "required": true }]
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    triggers = relationship(
        "Trigger", back_populates="connection", cascade="all, delete-orphan"
    )

    def to_dict(self, mask_secrets=True):
        """Convert to dictionary. Mask encrypted header values by default."""
        headers = []
        for h in self.headers or []:
            header = {"key": h.get("key"), "encrypted": h.get("encrypted", False)}
            if mask_secrets and h.get("encrypted"):
                header["value"] = "••••••"
            else:
                header["value"] = h.get("value")
            headers.append(header)
        return {
            "id": self.id,
            "name": self.name,
            "endpoint": self.endpoint,
            "method": self.method,
            "headers": headers,
            "fields": self.fields or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Trigger(Base):
    """Trigger that fires HTTP requests when emails are extracted."""

    __tablename__ = "triggers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    template_id = Column(
        Integer, ForeignKey("templates.id", ondelete="CASCADE"), nullable=False
    )
    connection_id = Column(
        Integer, ForeignKey("connections.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    field_mappings = Column(JSON, nullable=False, default=list)
    # [{ "source": "extracted_data.amount", "target": "payment.value" },
    #  { "source": "meta_data.received_at", "target": "timestamp" }]
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    template = relationship("Template", back_populates="triggers")
    connection = relationship("Connection", back_populates="triggers")

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "template_id": self.template_id,
            "connection_id": self.connection_id,
            "name": self.name,
            "is_active": self.is_active,
            "field_mappings": self.field_mappings,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TriggerLog(Base):
    """Log of trigger executions."""

    __tablename__ = "trigger_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trigger_id = Column(
        Integer, ForeignKey("triggers.id", ondelete="CASCADE"), nullable=False
    )
    email_id = Column(
        Integer, ForeignKey("emails.id", ondelete="CASCADE"), nullable=True
    )  # nullable for test executions
    request_url = Column(String, nullable=False)
    request_method = Column(String, nullable=False)
    request_headers = Column(
        JSON, nullable=False, default=dict
    )  # headers sent (secrets masked)
    request_body = Column(JSON, nullable=False, default=dict)  # actual payload sent
    response_status = Column(Integer, nullable=True)  # HTTP status code
    response_body = Column(Text, nullable=True)  # response body (truncated)
    status = Column(
        String, nullable=False, default="pending"
    )  # pending | success | failed
    executed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    trigger = relationship("Trigger")
    email = relationship("Email")

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "trigger_id": self.trigger_id,
            "email_id": self.email_id,
            "request_url": self.request_url,
            "request_method": self.request_method,
            "request_headers": self.request_headers,
            "request_body": self.request_body,
            "response_status": self.response_status,
            "response_body": self.response_body,
            "status": self.status,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
