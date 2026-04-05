"""Account management routes."""

from quart import Blueprint, request
from sqlalchemy import select

from hopthu.app import config
from hopthu.app.db import AsyncSession
from hopthu.app.models import Account
from hopthu.app.routes.auth import api_login_required
from hopthu.app.services.imap import test_connection

bp = Blueprint("accounts", __name__)


def success_response(data, pagination=None):
    """Return a standardized success response."""
    resp = {"data": data, "error": None}
    if pagination:
        resp["pagination"] = pagination
    return resp


def error_response(message):
    """Return a standardized error response."""
    return {"data": None, "error": {"message": message}}


@bp.route("/api/accounts", methods=["GET"])
@api_login_required
async def list_accounts():
    """List all accounts."""
    async with AsyncSession() as session:
        result = await session.execute(select(Account).order_by(Account.created_at.desc()))
        accounts = result.scalars().all()
        return success_response([a.to_dict() for a in accounts])


@bp.route("/api/accounts", methods=["POST"])
@api_login_required
async def create_account():
    """Create a new account."""
    data = await request.get_json()

    # Validate required fields
    required = ["email", "host", "password"]
    for field in required:
        if not data.get(field):
            return error_response(f"Missing required field: {field}"), 400

    # Extract fields
    email = data["email"]
    host = data["host"]
    port = data.get("port", 993)
    is_ssl = data.get("is_ssl", True)
    password = data["password"]
    auth_method = data.get("authenticated_method", "password")

    # Test connection before saving
    success, message = await test_connection(host, port, is_ssl, email, password)
    if not success:
        return error_response(f"Connection test failed: {message}"), 400

    # Encrypt password
    encrypted_credential = config.encrypt_credential(password)

    # Create account
    async with AsyncSession() as session:
        account = Account(
            email=email,
            host=host,
            port=port,
            is_ssl=is_ssl,
            authenticated_method=auth_method,
            credential=encrypted_credential,
        )
        session.add(account)
        await session.commit()
        await session.refresh(account)

        return success_response(account.to_dict()), 201


@bp.route("/api/accounts/<int:id>", methods=["PUT"])
@api_login_required
async def update_account(id):
    """Update an account."""
    data = await request.get_json()

    async with AsyncSession() as session:
        result = await session.execute(select(Account).where(Account.id == id))
        account = result.scalar_one_or_none()

        if not account:
            return error_response("Account not found"), 404

        # Update fields
        if "email" in data:
            account.email = data["email"]
        if "host" in data:
            account.host = data["host"]
        if "port" in data:
            account.port = data["port"]
        if "is_ssl" in data:
            account.is_ssl = data["is_ssl"]
        if "authenticated_method" in data:
            account.authenticated_method = data["authenticated_method"]

        # If password is provided, test and encrypt it
        if "password" in data and data["password"]:
            success, message = await test_connection(
                account.host, account.port, account.is_ssl, account.email, data["password"]
            )
            if not success:
                return error_response(f"Connection test failed: {message}"), 400
            account.credential = config.encrypt_credential(data["password"])

        await session.commit()
        await session.refresh(account)

        return success_response(account.to_dict())


@bp.route("/api/accounts/<int:id>", methods=["DELETE"])
@api_login_required
async def delete_account(id):
    """Delete an account and related data."""
    async with AsyncSession() as session:
        result = await session.execute(select(Account).where(Account.id == id))
        account = result.scalar_one_or_none()

        if not account:
            return error_response("Account not found"), 404

        await session.delete(account)
        await session.commit()

        return success_response({"deleted": True})


@bp.route("/api/accounts/<int:id>/test", methods=["POST"])
@api_login_required
async def test_account_connection(id):
    """Test IMAP connection for an account."""
    async with AsyncSession() as session:
        result = await session.execute(select(Account).where(Account.id == id))
        account = result.scalar_one_or_none()

        if not account:
            return error_response("Account not found"), 404

        # Decrypt password and test
        try:
            password = config.decrypt_credential(account.credential)
        except Exception as e:
            return error_response(f"Failed to decrypt credential: {str(e)}"), 500

        success, message = await test_connection(
            account.host, account.port, account.is_ssl, account.email, password
        )

        if success:
            return success_response({"connected": True, "message": message})
        else:
            return error_response(message), 400
