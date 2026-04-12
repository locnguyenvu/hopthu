"""Mailbox management routes."""

from quart import Blueprint, request
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert

from hopthu.app import config
from hopthu.app.db import AsyncSession
from hopthu.app.models import Account, Mailbox
from hopthu.app.routes.auth import api_login_required
from hopthu.app.services.imap import fetch_mailboxes as imap_fetch_mailboxes

bp = Blueprint("mailboxes", __name__)


def success_response(data):
    """Return a standardized success response."""
    return {"data": data, "error": None}


def error_response(message):
    """Return a standardized error response."""
    return {"data": None, "error": {"message": message}}


@bp.route("/api/accounts/<int:account_id>/mailboxes", methods=["GET"])
@api_login_required
async def list_mailboxes(account_id):
    """List mailboxes for an account."""
    async with AsyncSession() as session:
        result = await session.execute(
            select(Mailbox)
            .where(Mailbox.account_id == account_id)
            .order_by(Mailbox.name)
        )
        mailboxes = result.scalars().all()
        return success_response([m.to_dict() for m in mailboxes])


@bp.route("/api/accounts/<int:account_id>/mailboxes/fetch", methods=["POST"])
@api_login_required
async def fetch_mailboxes(account_id):
    """Fetch mailboxes from IMAP server."""
    async with AsyncSession() as session:
        # Get account
        result = await session.execute(select(Account).where(Account.id == account_id))
        account = result.scalar_one_or_none()

        if not account:
            return error_response("Account not found"), 404

        # Decrypt password
        try:
            password = config.decrypt_credential(account.credential)
        except Exception as e:
            return error_response(f"Failed to decrypt credential: {str(e)}"), 500

        # Fetch mailboxes from IMAP
        mailboxes, message = await imap_fetch_mailboxes(
            account.host, account.port, account.is_ssl, account.email, password
        )

        if not mailboxes:
            return error_response(message), 400

        # Upsert mailboxes - insert new ones, keep existing ones with their is_active state
        for mailbox_name in mailboxes:
            # Use INSERT OR IGNORE to avoid overwriting existing mailboxes
            stmt = (
                insert(Mailbox)
                .values(
                    account_id=account_id,
                    name=mailbox_name,
                    is_active=False,
                )
                .on_conflict_do_nothing(index_elements=["account_id", "name"])
            )
            await session.execute(stmt)

        await session.commit()

        # Return all mailboxes for this account
        result = await session.execute(
            select(Mailbox)
            .where(Mailbox.account_id == account_id)
            .order_by(Mailbox.name)
        )
        all_mailboxes = result.scalars().all()

        return success_response([m.to_dict() for m in all_mailboxes])


@bp.route("/api/mailboxes/<int:id>", methods=["PUT"])
@api_login_required
async def update_mailbox(id):
    """Update a mailbox (toggle is_active)."""
    data = await request.get_json()

    async with AsyncSession() as session:
        result = await session.execute(select(Mailbox).where(Mailbox.id == id))
        mailbox = result.scalar_one_or_none()

        if not mailbox:
            return error_response("Mailbox not found"), 404

        # Update fields
        if "is_active" in data:
            mailbox.is_active = data["is_active"]

        await session.commit()
        await session.refresh(mailbox)

        return success_response(mailbox.to_dict())
