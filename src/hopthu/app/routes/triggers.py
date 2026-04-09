"""Trigger management routes."""

from datetime import datetime
from quart import Blueprint, request
from sqlalchemy import select, desc

from hopthu.app.db import AsyncSession
from hopthu.app.models import Trigger, Connection, Template, TriggerLog
from hopthu.app.routes.auth import api_login_required
from hopthu.app.services.trigger import build_payload, execute_trigger

bp = Blueprint("triggers", __name__)


def success_response(data):
    """Return a standardized success response."""
    return {"data": data, "error": None}


def error_response(message):
    """Return a standardized error response."""
    return {"data": None, "error": {"message": message}}


@bp.route("/api/triggers", methods=["GET"])
@api_login_required
async def list_triggers():
    """List all triggers, optionally filtered by template_id or connection_id."""
    template_id = request.args.get("template_id", type=int)
    connection_id = request.args.get("connection_id", type=int)

    async with AsyncSession() as session:
        query = select(Trigger).order_by(Trigger.created_at.desc())
        if template_id:
            query = query.where(Trigger.template_id == template_id)
        if connection_id:
            query = query.where(Trigger.connection_id == connection_id)

        result = await session.execute(query)
        triggers = result.scalars().all()

        # Include connection and template info
        data = []
        for trigger in triggers:
            trigger_dict = trigger.to_dict()

            # Get connection name
            conn_result = await session.execute(
                select(Connection).where(Connection.id == trigger.connection_id)
            )
            connection = conn_result.scalar_one_or_none()
            trigger_dict["connection_name"] = connection.name if connection else None

            # Get template info
            template_result = await session.execute(
                select(Template).where(Template.id == trigger.template_id)
            )
            template = template_result.scalar_one_or_none()
            trigger_dict["template_from_email"] = template.from_email if template else None

            data.append(trigger_dict)

        return success_response(data)


@bp.route("/api/triggers", methods=["POST"])
@api_login_required
async def create_trigger():
    """Create a new trigger."""
    data = await request.get_json()

    # Validate required fields
    if not data.get("name"):
        return error_response("name is required"), 400
    if not data.get("template_id"):
        return error_response("template_id is required"), 400
    if not data.get("connection_id"):
        return error_response("connection_id is required"), 400

    # Verify template exists
    async with AsyncSession() as session:
        result = await session.execute(
            select(Template).where(Template.id == data["template_id"])
        )
        if not result.scalar_one_or_none():
            return error_response("Template not found"), 400

    # Verify connection exists
    async with AsyncSession() as session:
        result = await session.execute(
            select(Connection).where(Connection.id == data["connection_id"])
        )
        if not result.scalar_one_or_none():
            return error_response("Connection not found"), 400

    # Create trigger
    async with AsyncSession() as session:
        trigger = Trigger(
            name=data["name"],
            template_id=data["template_id"],
            connection_id=data["connection_id"],
            is_active=data.get("is_active", True),
            field_mappings=data.get("field_mappings", []),
        )
        session.add(trigger)
        await session.commit()
        await session.refresh(trigger)

        return success_response(trigger.to_dict()), 201


@bp.route("/api/triggers/<int:id>", methods=["GET"])
@api_login_required
async def get_trigger(id):
    """Get a trigger by ID."""
    async with AsyncSession() as session:
        result = await session.execute(select(Trigger).where(Trigger.id == id))
        trigger = result.scalar_one_or_none()

        if not trigger:
            return error_response("Trigger not found"), 404

        trigger_dict = trigger.to_dict()

        # Get connection details
        conn_result = await session.execute(
            select(Connection).where(Connection.id == trigger.connection_id)
        )
        connection = conn_result.scalar_one_or_none()
        trigger_dict["connection"] = connection.to_dict(mask_secrets=True) if connection else None

        # Get template details
        template_result = await session.execute(
            select(Template).where(Template.id == trigger.template_id)
        )
        template = template_result.scalar_one_or_none()
        trigger_dict["template"] = {
            "id": template.id,
            "from_email": template.from_email,
            "subject": template.subject,
        } if template else None

        return success_response(trigger_dict)


@bp.route("/api/triggers/<int:id>", methods=["PUT"])
@api_login_required
async def update_trigger(id):
    """Update a trigger."""
    data = await request.get_json()

    async with AsyncSession() as session:
        result = await session.execute(select(Trigger).where(Trigger.id == id))
        trigger = result.scalar_one_or_none()

        if not trigger:
            return error_response("Trigger not found"), 404

        # Update fields
        if "name" in data:
            trigger.name = data["name"]

        if "template_id" in data:
            # Verify template exists
            result = await session.execute(
                select(Template).where(Template.id == data["template_id"])
            )
            if not result.scalar_one_or_none():
                return error_response("Template not found"), 400
            trigger.template_id = data["template_id"]

        if "connection_id" in data:
            # Verify connection exists
            result = await session.execute(
                select(Connection).where(Connection.id == data["connection_id"])
            )
            if not result.scalar_one_or_none():
                return error_response("Connection not found"), 400
            trigger.connection_id = data["connection_id"]

        if "is_active" in data:
            trigger.is_active = data["is_active"]

        if "field_mappings" in data:
            trigger.field_mappings = data["field_mappings"]

        await session.commit()
        await session.refresh(trigger)

        return success_response(trigger.to_dict())


@bp.route("/api/triggers/<int:id>", methods=["DELETE"])
@api_login_required
async def delete_trigger(id):
    """Delete a trigger."""
    async with AsyncSession() as session:
        result = await session.execute(select(Trigger).where(Trigger.id == id))
        trigger = result.scalar_one_or_none()

        if not trigger:
            return error_response("Trigger not found"), 404

        # Delete associated logs first
        result = await session.execute(
            select(TriggerLog).where(TriggerLog.trigger_id == id)
        )
        for log in result.scalars().all():
            await session.delete(log)

        await session.delete(trigger)
        await session.commit()

        return success_response({"deleted": True})


@bp.route("/api/triggers/<int:id>/test", methods=["POST"])
@api_login_required
async def test_trigger(id):
    """Test a trigger with sample data."""
    data = await request.get_json()

    async with AsyncSession() as session:
        result = await session.execute(select(Trigger).where(Trigger.id == id))
        trigger = result.scalar_one_or_none()

        if not trigger:
            return error_response("Trigger not found"), 404

        # Get connection
        conn_result = await session.execute(
            select(Connection).where(Connection.id == trigger.connection_id)
        )
        connection = conn_result.scalar_one_or_none()

        if not connection:
            return error_response("Connection not found"), 404

    # Use provided sample data or empty defaults
    sample_extracted_data = data.get("extracted_data", {})
    sample_email = data.get("email", {
        "received_at": datetime.utcnow().isoformat(),
        "from_email": "test@example.com",
    })

    # Build the payload
    payload = build_payload(
        trigger.field_mappings or [],
        sample_extracted_data,
        sample_email
    )

    # Import execute functionality
    import aiohttp
    from hopthu.app import config

    # Build headers - decrypt encrypted values
    headers = {}
    masked_headers = {}
    for h in (connection.headers or []):
        key = h.get("key")
        value = h.get("value", "")
        encrypted = h.get("encrypted", False)

        if encrypted and value:
            try:
                headers[key] = config.decrypt_credential(value)
                masked_headers[key] = "••••••"
            except Exception:
                headers[key] = value
                masked_headers[key] = "••••••"
        else:
            headers[key] = value
            masked_headers[key] = value

    # Execute the HTTP request
    try:
        async with aiohttp.ClientSession() as http_session:
            method = connection.method or "POST"
            url = connection.endpoint

            async with http_session.request(
                method=method,
                url=url,
                headers=headers,
                json=payload if method in ["POST", "PUT"] else None,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                response_status = response.status
                try:
                    response_body = await response.text()
                    if len(response_body) > 2000:
                        response_body = response_body[:2000] + "..."
                except Exception:
                    response_body = None

                return success_response({
                    "request_url": url,
                    "request_method": method,
                    "request_headers": masked_headers,
                    "request_body": payload,
                    "response_status": response_status,
                    "response_body": response_body,
                    "success": response_status < 400
                })

    except Exception as e:
        return error_response(f"Request failed: {str(e)}"), 400


@bp.route("/api/triggers/<int:id>/logs", methods=["GET"])
@api_login_required
async def get_trigger_logs(id):
    """Get logs for a trigger."""
    limit = request.args.get("limit", default=50, type=int)
    offset = request.args.get("offset", default=0, type=int)

    async with AsyncSession() as session:
        # Verify trigger exists
        result = await session.execute(select(Trigger).where(Trigger.id == id))
        if not result.scalar_one_or_none():
            return error_response("Trigger not found"), 404

        # Get logs
        result = await session.execute(
            select(TriggerLog)
            .where(TriggerLog.trigger_id == id)
            .order_by(desc(TriggerLog.executed_at))
            .limit(limit)
            .offset(offset)
        )
        logs = result.scalars().all()

        # Get total count
        from sqlalchemy import func
        count_result = await session.execute(
            select(func.count(TriggerLog.id)).where(TriggerLog.trigger_id == id)
        )
        total = count_result.scalar()

        data = [log.to_dict() for log in logs]

        return success_response({
            "logs": data,
            "total": total,
            "limit": limit,
            "offset": offset
        })


@bp.route("/api/trigger-logs", methods=["GET"])
@api_login_required
async def list_all_trigger_logs():
    """List all trigger logs, optionally filtered."""
    trigger_id = request.args.get("trigger_id", type=int)
    email_id = request.args.get("email_id", type=int)
    status = request.args.get("status")
    limit = request.args.get("limit", default=50, type=int)
    offset = request.args.get("offset", default=0, type=int)

    async with AsyncSession() as session:
        query = select(TriggerLog).order_by(desc(TriggerLog.executed_at))

        if trigger_id:
            query = query.where(TriggerLog.trigger_id == trigger_id)
        if email_id:
            query = query.where(TriggerLog.email_id == email_id)
        if status:
            query = query.where(TriggerLog.status == status)

        query = query.limit(limit).offset(offset)

        result = await session.execute(query)
        logs = result.scalars().all()

        # Get total count
        from sqlalchemy import func
        count_query = select(func.count(TriggerLog.id))
        if trigger_id:
            count_query = count_query.where(TriggerLog.trigger_id == trigger_id)
        if email_id:
            count_query = count_query.where(TriggerLog.email_id == email_id)
        if status:
            count_query = count_query.where(TriggerLog.status == status)

        count_result = await session.execute(count_query)
        total = count_result.scalar()

        # Add trigger name to each log
        data = []
        for log in logs:
            log_dict = log.to_dict()

            # Get trigger name
            trigger_result = await session.execute(
                select(Trigger).where(Trigger.id == log.trigger_id)
            )
            trigger = trigger_result.scalar_one_or_none()
            log_dict["trigger_name"] = trigger.name if trigger else None

            data.append(log_dict)

        return success_response({
            "logs": data,
            "total": total,
            "limit": limit,
            "offset": offset
        })