"""Email routes."""

from datetime import datetime
from quart import Blueprint, request
from quart import current_app
from sqlalchemy import select, desc, and_

from hopthu.app.db import AsyncSession
from hopthu.app.models import Email, EmailData
from hopthu.app.routes.auth import api_login_required
from sqlalchemy.orm import selectinload, joinedload
from hopthu.app.services.sync import sync_account, sync_all

bp = Blueprint("emails", __name__)


def success_response(data, pagination=None):
    """Return a standardized success response."""
    resp = {"data": data, "error": None}
    if pagination:
        resp["pagination"] = pagination
    return resp


def error_response(message):
    """Return a standardized error response."""
    return {"data": None, "error": {"message": message}}


@bp.route("/api/emails", methods=["GET"])
@api_login_required
async def list_emails():
    """List emails with filtering and pagination."""
    # Get query parameters
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    from_email = request.args.get("from_email")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    status = request.args.get("status")
    account_id = request.args.get("account_id", type=int)
    mailbox_id = request.args.get("mailbox_id", type=int)

    async with AsyncSession() as session:
        # Build query
        query = select(Email)

        # Apply filters
        filters = []
        if from_email:
            filters.append(Email.from_email.ilike(f"%{from_email}%"))
        if status:
            filters.append(Email.status == status)
        if account_id:
            filters.append(Email.account_id == account_id)
        if mailbox_id:
            filters.append(Email.mailbox_id == mailbox_id)
        if date_from:
            try:
                dt = datetime.fromisoformat(date_from)
                filters.append(Email.received_at >= dt)
            except:
                pass
        if date_to:
            try:
                dt = datetime.fromisoformat(date_to)
                filters.append(Email.received_at <= dt)
            except:
                pass

        if filters:
            query = query.where(and_(*filters))

        # Order by received_at DESC
        query = query.order_by(desc(Email.received_at))

        # Get total count
        count_query = select(Email)
        if filters:
            count_query = count_query.where(and_(*filters))
        result = await session.execute(count_query)
        total = len(result.scalars().all())

        # Apply pagination
        offset = (page - 1) * per_page
        query = query.offset(offset).limit(per_page)

        result = await session.execute(query)
        emails = result.scalars().all()

        return success_response(
            [e.to_dict() for e in emails],
            pagination={
                "page": page,
                "per_page": per_page,
                "total": total,
            }
        )


@bp.route("/api/emails/<int:id>", methods=["GET"])
@api_login_required
async def get_email(id):
    """Get a single email by ID."""
    async with AsyncSession() as session:
        result = await session.execute(
            select(Email)
            .where(Email.id == id)
            .options(
                selectinload(Email.email_data).joinedload(EmailData.template)
            )
        )
        email = result.scalar_one_or_none()

        if not email:
            return error_response("Email not found"), 404

        data = email.to_dict()
        data["body"] = email.body

        # Include email_data if exists
        if email.email_data:
            data["email_data"] = email.email_data.to_dict()
            data["email_data"]["template"] = email.email_data.template.to_dict() if email.email_data.template else None

        return success_response(data)


@bp.route("/api/emails/<int:id>/status", methods=["PUT"])
@api_login_required
async def update_email_status(id):
    """Update email status (new, ignored)."""
    data = await request.get_json()

    async with AsyncSession() as session:
        result = await session.execute(select(Email).where(Email.id == id))
        email = result.scalar_one_or_none()

        if not email:
            return error_response("Email not found"), 404

        if "status" in data:
            email.status = data["status"]

        await session.commit()
        await session.refresh(email)

        return success_response(email.to_dict())


@bp.route("/api/sync", methods=["POST"])
@api_login_required
async def trigger_sync_all():
    """Trigger sync for all accounts."""
    # Run sync as background task
    current_app.add_background_task(sync_all)
    return success_response({"message": "Sync started"}, None), 202


@bp.route("/api/accounts/<int:account_id>/sync", methods=["POST"])
@api_login_required
async def trigger_sync_account(account_id):
    """Trigger sync for a specific account."""
    # Run sync as background task
    current_app.add_background_task(sync_account, account_id)
    return success_response({"message": "Sync started"}, None), 202
