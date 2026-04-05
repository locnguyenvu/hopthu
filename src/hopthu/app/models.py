"""SQLAlchemy ORM models for the email client."""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON,
    UniqueConstraint, Index
)
from sqlalchemy.orm import DeclarativeBase, relationship


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
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    mailboxes = relationship("Mailbox", back_populates="account", cascade="all, delete-orphan")
    emails = relationship("Email", back_populates="account", cascade="all, delete-orphan")

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
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    account = relationship("Account", back_populates="mailboxes")
    emails = relationship("Email", back_populates="mailbox", cascade="all, delete-orphan")

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
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    mailbox_id = Column(Integer, ForeignKey("mailboxes.id", ondelete="CASCADE"), nullable=False)
    from_email = Column(String, nullable=False)
    to_email = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    content_type = Column(String, nullable=False)  # 'text/plain' or 'text/html'
    body = Column(Text, nullable=True)
    message_id = Column(String, nullable=False)  # extracted from Message-ID header
    meta_data = Column(JSON, nullable=False, default=dict)  # additional headers
    status = Column(String, nullable=False, default="new")  # new | extracted | ignored
    received_at = Column(DateTime, nullable=False)  # from IMAP server, stored in app timezone
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    account = relationship("Account", back_populates="emails")
    mailbox = relationship("Mailbox", back_populates="emails")
    email_data = relationship("EmailData", back_populates="email", uselist=False, cascade="all, delete-orphan")

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
    __table_args__ = (
        Index("idx_templates_from", "from_email"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_email = Column(String, nullable=False)
    subject = Column(String, nullable=True)  # NULL = match any subject from this sender
    content_type = Column(String, nullable=False)
    template = Column(Text, nullable=False)  # template body with variable markers
    fields = Column(JSON, nullable=False, default=list)  # list of variable names
    priority = Column(Integer, nullable=True)  # NULL = auto-order
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    email_data = relationship("EmailData", back_populates="template", cascade="all, delete-orphan")

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
    email_id = Column(Integer, ForeignKey("emails.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="CASCADE"), nullable=False)
    data = Column(JSON, nullable=False, default=dict)  # { meta_data: {...}, extracted_data: {...} }
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
