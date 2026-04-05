"""Application configuration with environment variables and Fernet encryption."""

import base64
import hashlib
import os
from pathlib import Path

from cryptography.fernet import Fernet


# Configuration values from environment
QUART_SECRET_KEY = os.environ.get("QUART_SECRET_KEY", "dev-secret-key-change-in-production")
QUART_DB_PATH = os.environ.get("QUART_DB_PATH", str(Path(__file__).parent.parent.parent / "data.db"))
QUART_USER_PASSWORD_HASH = os.environ.get("QUART_USER_PASSWORD_HASH", "")
QUART_TZ = os.environ.get("QUART_TZ", "Asia/Ho_Chi_Minh")


def get_fernet() -> Fernet:
    """Derive a Fernet-compatible key from QUART_SECRET_KEY."""
    key = hashlib.sha256(QUART_SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_credential(plain_text: str) -> str:
    """Encrypt a credential string using Fernet."""
    return get_fernet().encrypt(plain_text.encode()).decode()


def decrypt_credential(encrypted: str) -> str:
    """Decrypt a credential string using Fernet."""
    return get_fernet().decrypt(encrypted.encode()).decode()
