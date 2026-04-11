"""Trigger execution service - payload building and HTTP request execution."""

import aiohttp
from datetime import datetime
from typing import Any

from sqlalchemy import select

from hopthu.app import config
from hopthu.app.db import AsyncSession
from hopthu.app.models import Trigger, Connection, TriggerLog, Email, EmailData, EMAIL_STATUS_PUSHED


# Sentinel value for "path not found"
_NOT_FOUND = object()


def resolve_source_value(
    source_path: str,
    extracted_data: dict,
    email: dict
) -> Any:
    """
    Resolve a source path to its value.

    Args:
        source_path: Dot-path like "$extracted_data.amount" or "$email.received_at"
        extracted_data: Dictionary of extracted email data (from EmailData)
        email: Dictionary of email fields (from Email model)

    Returns:
        The value at the path, or _NOT_FOUND if path doesn't exist
    """
    parts = source_path.split(".")
    if len(parts) < 2:
        return _NOT_FOUND

    namespace = parts[0]
    path_parts = parts[1:]

    if namespace == "$extracted_data":
        data = extracted_data
    elif namespace == "$email":
        data = email
    else:
        return _NOT_FOUND

    # Navigate the path
    for key in path_parts:
        if not isinstance(data, dict):
            return _NOT_FOUND
        if key not in data:
            return _NOT_FOUND
        data = data[key]

    return data


def build_payload(
    field_mappings: list,
    extracted_data: dict,
    email: dict
) -> dict:
    """
    Build a request payload from field mappings.

    Args:
        field_mappings: List of {source, target} mappings
        extracted_data: Dictionary of extracted email data (from EmailData)
        email: Dictionary of email fields (from Email model)

    Returns:
        Populated payload dictionary
    """
    payload = {}

    for mapping in field_mappings:
        source = mapping.get("source", "")
        target = mapping.get("target", "")

        if not source or not target:
            continue

        # Get the value from source
        value = resolve_source_value(source, extracted_data, email)

        # Skip if path not found
        if value is _NOT_FOUND:
            continue

        # Set the value at target path
        target_parts = target.split(".")

        # Navigate to the parent and set the final key
        current = payload
        for i, key in enumerate(target_parts[:-1]):
            if key not in current:
                current[key] = {}
            current = current[key]

        # Set the final value
        final_key = target_parts[-1]
        current[final_key] = value

    return payload


async def execute_trigger(
    trigger: Trigger,
    email_data: EmailData,
    email: Email
) -> TriggerLog:
    """
    Execute a trigger for an email.

    Args:
        trigger: The Trigger model instance
        email_data: The EmailData model instance with extracted data
        email: The Email model instance

    Returns:
        TriggerLog instance recording the execution
    """
    # Get the connection
    async with AsyncSession() as session:
        result = await session.execute(
            select(Connection).where(Connection.id == trigger.connection_id)
        )
        connection = result.scalar_one_or_none()

    if not connection:
        # Log failure - connection not found
        log = TriggerLog(
            trigger_id=trigger.id,
            email_id=email.id,
            request_url="",
            request_method="",
            request_headers={},
            request_body={},
            response_status=None,
            response_body=None,
            status="failed",
            executed_at=datetime.utcnow()
        )
        return log

    # Build the payload
    data = email_data.data or {}
    extracted_data = data.get("extracted_data", {})

    # Build email dict from Email model for $email sources
    email_dict = {
        "id": email.id,
        "from_email": email.from_email,
        "to_email": email.to_email,
        "subject": email.subject,
        "received_at": email.received_at.isoformat() if email.received_at else None,
        "message_id": email.message_id,
        "status": email.status,
    }

    payload = build_payload(
        trigger.field_mappings or [],
        extracted_data,
        email_dict
    )

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
    executed_at = datetime.utcnow()
    status = "pending"
    response_status = None
    response_body = None

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
                    # Truncate if too long
                    if len(response_body) > 2000:
                        response_body = response_body[:2000] + "..."
                except Exception:
                    response_body = None

                status = "success" if response_status < 400 else "failed"

    except Exception as e:
        status = "failed"
        response_body = str(e)

    # Create log entry
    log = TriggerLog(
        trigger_id=trigger.id,
        email_id=email.id,
        request_url=connection.endpoint,
        request_method=connection.method or "POST",
        request_headers=masked_headers,
        request_body=payload,
        response_status=response_status,
        response_body=response_body,
        status=status,
        executed_at=executed_at
    )

    return log


async def run_triggers_for_email(email_id: int) -> list:
    """
    Find and execute all active triggers for an email.

    Args:
        email_id: The ID of the extracted email

    Returns:
        List of TriggerLog instances
    """
    async with AsyncSession() as session:
        # Get the email and its extracted data
        result = await session.execute(
            select(Email).where(Email.id == email_id)
        )
        email = result.scalar_one_or_none()

        if not email:
            return []

        # Get the email data
        result = await session.execute(
            select(EmailData).where(EmailData.email_id == email_id)
        )
        email_data = result.scalar_one_or_none()

        if not email_data:
            return []

        # Find all active triggers for the template
        result = await session.execute(
            select(Trigger).where(
                Trigger.template_id == email_data.template_id,
                Trigger.is_active
            )
        )
        triggers = result.scalars().all()

        logs = []
        for trigger in triggers:
            log = await execute_trigger(trigger, email_data, email)
            session.add(log)
            logs.append(log)

        # Check if any triggers were successful and update email status accordingly
        if logs and any(log.status == "success" for log in logs):
            email.status = EMAIL_STATUS_PUSHED
            session.add(email)

        await session.commit()

        return logs