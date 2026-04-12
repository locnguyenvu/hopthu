"""Connection management routes."""

import aiohttp
from quart import Blueprint, request
from sqlalchemy import select, func

from hopthu.app import config
from hopthu.app.db import AsyncSession
from hopthu.app.models import Connection, Trigger
from hopthu.app.routes.auth import api_login_required

bp = Blueprint("connections", __name__)


def success_response(data):
    """Return a standardized success response."""
    return {"data": data, "error": None}


def error_response(message):
    """Return a standardized error response."""
    return {"data": None, "error": {"message": message}}


def encrypt_headers(headers):
    """Encrypt header values marked as encrypted."""
    processed = []
    for h in headers:
        header = {"key": h.get("key"), "encrypted": h.get("encrypted", False)}
        if header["encrypted"] and h.get("value") and h["value"] != "••••••":
            # Encrypt the value if it's new (not already masked placeholder)
            header["value"] = config.encrypt_credential(h["value"])
        else:
            header["value"] = h.get("value", "")
        processed.append(header)
    return processed


async def get_trigger_count(connection_id):
    """Get count of triggers referencing a connection."""
    async with AsyncSession() as session:
        result = await session.execute(
            select(func.count(Trigger.id)).where(Trigger.connection_id == connection_id)
        )
        return result.scalar()


@bp.route("/api/connections", methods=["GET"])
@api_login_required
async def list_connections():
    """List all connections."""
    async with AsyncSession() as session:
        result = await session.execute(
            select(Connection).order_by(Connection.created_at.desc())
        )
        connections = result.scalars().all()

        # Add trigger count to each connection
        data = []
        for conn in connections:
            conn_dict = conn.to_dict(mask_secrets=True)
            conn_dict["trigger_count"] = await get_trigger_count(conn.id)
            data.append(conn_dict)

        return success_response(data)


def validate_fields(fields):
    """Validate fields structure."""
    if not isinstance(fields, list):
        return False, "fields must be an array"
    for field in fields:
        if not isinstance(field, dict):
            return False, "each field must be an object"
        if not field.get("name"):
            return False, "each field must have a name"
        if field.get("type") not in ("string", "number", "boolean", None):
            return False, "field type must be string, number, or boolean"
    return True, None


@bp.route("/api/connections", methods=["POST"])
@api_login_required
async def create_connection():
    """Create a new connection."""
    data = await request.get_json()

    # Validate required fields
    if not data.get("name"):
        return error_response("name is required"), 400
    if not data.get("endpoint"):
        return error_response("endpoint is required"), 400

    # Validate fields structure
    fields = data.get("fields", [])
    valid, msg = validate_fields(fields)
    if not valid:
        return error_response(msg), 400

    # Check for duplicate name
    async with AsyncSession() as session:
        result = await session.execute(
            select(Connection).where(Connection.name == data["name"])
        )
        if result.scalar_one_or_none():
            return error_response(f"Connection '{data['name']}' already exists"), 400

    # Process headers - encrypt marked values
    headers = data.get("headers", [])
    processed_headers = encrypt_headers(headers)

    # Normalize fields - set defaults
    normalized_fields = []
    for f in fields:
        normalized_fields.append(
            {
                "name": f.get("name"),
                "type": f.get("type", "string"),
                "required": f.get("required", False),
            }
        )

    # Create connection
    async with AsyncSession() as session:
        connection = Connection(
            name=data["name"],
            endpoint=data["endpoint"],
            method=data.get("method", "POST"),
            headers=processed_headers,
            fields=normalized_fields,
        )
        session.add(connection)
        await session.commit()
        await session.refresh(connection)

        return success_response(connection.to_dict(mask_secrets=True)), 201


@bp.route("/api/connections/<int:id>", methods=["GET"])
@api_login_required
async def get_connection(id):
    """Get a connection by ID."""
    async with AsyncSession() as session:
        result = await session.execute(select(Connection).where(Connection.id == id))
        connection = result.scalar_one_or_none()

        if not connection:
            return error_response("Connection not found"), 404

        conn_dict = connection.to_dict(mask_secrets=True)
        conn_dict["trigger_count"] = await get_trigger_count(connection.id)

        return success_response(conn_dict)


@bp.route("/api/connections/<int:id>", methods=["PUT"])
@api_login_required
async def update_connection(id):
    """Update a connection."""
    data = await request.get_json()

    async with AsyncSession() as session:
        result = await session.execute(select(Connection).where(Connection.id == id))
        connection = result.scalar_one_or_none()

        if not connection:
            return error_response("Connection not found"), 404

        # Update basic fields
        if "name" in data:
            # Check for duplicate name (excluding current)
            result = await session.execute(
                select(Connection).where(
                    Connection.name == data["name"], Connection.id != id
                )
            )
            if result.scalar_one_or_none():
                return error_response(
                    f"Connection '{data['name']}' already exists"
                ), 400
            connection.name = data["name"]

        if "endpoint" in data:
            connection.endpoint = data["endpoint"]

        if "method" in data:
            connection.method = data["method"]

        # Update headers - handle encrypted value preservation
        if "headers" in data:
            new_headers = []
            for h in data["headers"]:
                header = {"key": h.get("key"), "encrypted": h.get("encrypted", False)}

                if header["encrypted"]:
                    if h.get("value") == "••••••" or not h.get("value"):
                        # Keep existing encrypted value (find it in current headers)
                        existing = next(
                            (
                                eh
                                for eh in connection.headers
                                if eh.get("key") == h.get("key")
                            ),
                            None,
                        )
                        if existing:
                            header["value"] = existing.get("value")
                        else:
                            header["value"] = ""
                    else:
                        # Encrypt new value
                        header["value"] = config.encrypt_credential(h["value"])
                else:
                    header["value"] = h.get("value", "")

                new_headers.append(header)

            connection.headers = new_headers

        # Update fields - validate and normalize
        if "fields" in data:
            valid, msg = validate_fields(data["fields"])
            if not valid:
                return error_response(msg), 400
            normalized_fields = []
            for f in data["fields"]:
                normalized_fields.append(
                    {
                        "name": f.get("name"),
                        "type": f.get("type", "string"),
                        "required": f.get("required", False),
                    }
                )
            connection.fields = normalized_fields

        await session.commit()
        await session.refresh(connection)

        return success_response(connection.to_dict(mask_secrets=True))


@bp.route("/api/connections/<int:id>", methods=["DELETE"])
@api_login_required
async def delete_connection(id):
    """Delete a connection."""
    async with AsyncSession() as session:
        result = await session.execute(select(Connection).where(Connection.id == id))
        connection = result.scalar_one_or_none()

        if not connection:
            return error_response("Connection not found"), 404

        # Check if any triggers reference this connection
        result = await session.execute(
            select(func.count(Trigger.id)).where(Trigger.connection_id == id)
        )
        trigger_count = result.scalar()

        if trigger_count > 0:
            return error_response(
                f"Cannot delete connection: {trigger_count} trigger(s) reference this connection"
            ), 409

        await session.delete(connection)
        await session.commit()

        return success_response({"deleted": True})


@bp.route("/api/connections/<int:id>/test", methods=["POST"])
@api_login_required
async def test_connection(id):
    """Test a connection by sending a request to its endpoint."""
    async with AsyncSession() as session:
        result = await session.execute(select(Connection).where(Connection.id == id))
        connection = result.scalar_one_or_none()

        if not connection:
            return error_response("Connection not found"), 404

    # Build headers - decrypt encrypted values
    headers = {}
    for h in connection.headers:
        key = h.get("key")
        value = h.get("value")
        if h.get("encrypted") and value:
            try:
                value = config.decrypt_credential(value)
            except Exception:
                return error_response(f"Failed to decrypt header '{key}'"), 500
        headers[key] = value

    # Send request
    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.request(
                method=connection.method,
                url=connection.endpoint,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as response:
                response_status = response.status
                response_body = await response.text()

                # Truncate response body if too long
                if len(response_body) > 1000:
                    response_body = response_body[:1000] + "..."

                return success_response(
                    {
                        "response_status": response_status,
                        "response_body": response_body,
                        "success": response_status < 400,
                    }
                )

    except Exception as e:
        return error_response(f"Request failed: {str(e)}"), 400
