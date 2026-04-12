"""Email parsing service using docthu library."""

from datetime import date, datetime
import json
from sqlalchemy import select

from hopthu.app.db import AsyncSession
from hopthu.app.models import Template, Email, EmailData, EMAIL_STATUS_EXTRACTED

try:
    from docthu import parse as docthu_parse
    from docthu import Template as DocthuTemplate
except ImportError:
    # Fallback if docthu is not available
    docthu_parse = None
    DocthuTemplate = None


class _DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles date and datetime objects."""

    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return super().default(obj)


def _make_json_serializable(data):
    """Convert date/datetime objects in data to ISO format strings."""
    return json.loads(json.dumps(data, cls=_DateTimeEncoder))


async def find_matching_templates(from_email: str) -> list[Template]:
    """
    Find templates matching a sender email, ordered by priority.

    Priority order:
    1. Templates with explicit priority (sorted by priority ASC)
    2. Templates with matching subject (sorted by created_at ASC)
    3. Catch-all templates (subject IS NULL, sorted by created_at ASC)
    """
    async with AsyncSession() as session:
        # Get all templates for this sender
        result = await session.execute(
            select(Template).where(Template.from_email == from_email)
        )
        templates = result.scalars().all()

        # Sort by priority rules
        # 1. Explicit priority first (priority IS NOT NULL)
        # 2. Subject match (priority IS NULL, subject IS NOT NULL)
        # 3. Catch-all (priority IS NULL, subject IS NULL)
        def sort_key(t):
            if t.priority is not None:
                return (0, t.priority, t.created_at)
            elif t.subject is not None:
                return (1, 0, t.created_at)
            else:
                return (2, 0, t.created_at)

        return sorted(templates, key=sort_key)


def parse_email(template: Template, email_body: str, content_type: str) -> dict | None:
    """
    Parse an email using docthu template.

    Returns:
        Dict with extracted fields on success, None on failure
    """
    if docthu_parse is None:
        # Fallback: simple string replacement
        import re

        # Extract fields using {{field_name}} pattern
        pattern = r"\{\{(\w+)\}\}"
        field_names = re.findall(pattern, template.template)

        if not field_names:
            return None

        # Build a regex pattern from the template
        # Escape special regex characters and replace {{field}} with capture groups
        escaped_template = re.escape(template.template)
        for field in field_names:
            escaped_template = escaped_template.replace(
                re.escape(f"{{{{{field}}}}}"), r"(.*?)"
            )

        # Match the template against the email body
        match = re.search(escaped_template, email_body, re.DOTALL)

        if not match:
            return None

        # Extract field values
        result = {}
        for i, field in enumerate(field_names):
            if i < len(match.groups()):
                result[field] = match.group(i + 1).strip()

        return result

    try:
        result = docthu_parse(
            template.template,
            email_body,
            stop_on_filled=[v["name"] for v in template.fields],
        )

        if result:
            # Convert date/datetime objects to ISO format strings for JSON serialization
            return _make_json_serializable(result)
        return None
    except Exception as e:
        print(f"Parse error: {e}")
        return None


async def process_email(email_id: int, connection=None) -> dict:
    """
    Process an email: find matching templates and extract data.

    Args:
        email_id: ID of the email to process
        connection: Optional database connection to use instead of creating a new session

    Returns:
        Dict with extraction results
    """

    async def _process_with_session(session):
        # Get email
        result = await session.execute(select(Email).where(Email.id == email_id))
        email = result.scalar_one_or_none()

        if not email:
            return {"error": "Email not found"}

        # Find matching templates
        templates = await find_matching_templates(email.from_email)

        if not templates:
            return {"error": "No matching templates"}

        # Try each template in order
        for template in templates:
            extracted = parse_email(template, email.body, email.content_type)

            if extracted:
                # Check if email_data already exists
                result = await session.execute(
                    select(EmailData).where(EmailData.email_id == email_id)
                )
                existing = result.scalar_one_or_none()

                if existing:
                    # Update existing
                    existing.template_id = template.id
                    existing.data = {
                        "meta_data": {"received_at": email.received_at.isoformat()},
                        "extracted_data": extracted,
                    }
                else:
                    # Create new
                    email_data = EmailData(
                        email_id=email_id,
                        template_id=template.id,
                        data={
                            "meta_data": {"received_at": email.received_at.isoformat()},
                            "extracted_data": extracted,
                        },
                    )
                    session.add(email_data)

                # Update email status
                email.status = EMAIL_STATUS_EXTRACTED
                await session.commit()

                # Run triggers for the extracted email
                from hopthu.app.services.trigger import run_triggers_for_email

                try:
                    # Pass the session/connection to trigger execution if available
                    await run_triggers_for_email(email_id, connection=session)
                except Exception as e:
                    # Log error but don't fail the extraction
                    print(f"Trigger execution error: {e}")

                return {
                    "success": True,
                    "template_id": template.id,
                    "data": extracted,
                }

        # No template matched
        return {"error": "No template matched the email content"}

    if connection is not None:
        # Use the provided connection
        return await _process_with_session(connection)
    else:
        # Create a new session
        async with AsyncSession() as session:
            return await _process_with_session(session)
