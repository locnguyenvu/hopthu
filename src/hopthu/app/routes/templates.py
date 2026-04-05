"""Template management routes."""

from quart import Blueprint, request
from sqlalchemy import select

from hopthu.app.db import AsyncSession
from hopthu.app.models import Template, Email
from hopthu.app.routes.auth import api_login_required
from hopthu.app.services.parser import find_matching_templates, parse_email

try:
    from docthu import Template as DocthuTemplate
except ImportError:
    DocthuTemplate = None

bp = Blueprint("templates", __name__)


def success_response(data):
    """Return a standardized success response."""
    return {"data": data, "error": None}


def error_response(message):
    """Return a standardized error response."""
    return {"data": None, "error": {"message": message}}


@bp.route("/api/templates", methods=["GET"])
@api_login_required
async def list_templates():
    """List all templates."""
    async with AsyncSession() as session:
        result = await session.execute(
            select(Template).order_by(Template.from_email, Template.priority, Template.created_at)
        )
        templates = result.scalars().all()
        return success_response([{k: v for k, v in t.to_dict().items() if k != "fields"} for t in templates])


@bp.route("/api/templates/extract-fields", methods=["POST"])
@api_login_required
async def extract_template_fields():
    """Extract fields/variables from provided template content."""
    data = await request.get_json()

    if not data.get("template"):
        return error_response("template is required"), 400

    if not DocthuTemplate:
        return error_response("docthu library is not available"), 500

    try:
        tpl = DocthuTemplate(data["template"])
        fields = tpl.variables()
    except Exception as e:
        return error_response(f"Failed to extract fields: {str(e)}"), 400

    return success_response(fields)


@bp.route("/api/templates", methods=["POST"])
@api_login_required
async def create_template():
    """Create a new template."""
    data = await request.get_json()

    # Validate required fields
    if not data.get("from_email"):
        return error_response("from_email is required"), 400
    if not data.get("template"):
        return error_response("template is required"), 400

    # Auto-extract fields from template content using docthu.Template.variables()
    if not DocthuTemplate:
        return error_response("docthu library is not available"), 500

    try:
        tpl = DocthuTemplate(data["template"])
        fields = tpl.variables()
    except Exception as e:
        return error_response(f"Failed to extract fields: {str(e)}"), 400

    async with AsyncSession() as session:
        template = Template(
            from_email=data["from_email"],
            subject=data.get("subject"),
            content_type=data.get("content_type", "text/plain"),
            template=data["template"],
            fields=fields,
            priority=data.get("priority"),
        )
        session.add(template)
        await session.commit()
        await session.refresh(template)

        return success_response(template.to_dict()), 201


@bp.route("/api/templates/<int:id>", methods=["GET"])
@api_login_required
async def get_template(id):
    """Get a template by ID."""
    async with AsyncSession() as session:
        result = await session.execute(select(Template).where(Template.id == id))
        template = result.scalar_one_or_none()

        if not template:
            return error_response("Template not found"), 404

        data = template.to_dict()
        data["template"] = template.template

        return success_response(data)


@bp.route("/api/templates/<int:id>", methods=["PUT"])
@api_login_required
async def update_template(id):
    """Update a template."""
    data = await request.get_json()

    async with AsyncSession() as session:
        result = await session.execute(select(Template).where(Template.id == id))
        template = result.scalar_one_or_none()

        if not template:
            return error_response("Template not found"), 404

        # Update fields
        if "from_email" in data:
            template.from_email = data["from_email"]
        if "subject" in data:
            template.subject = data["subject"]
        if "content_type" in data:
            template.content_type = data["content_type"]
        if "template" in data:
            template.template = data["template"]
            # Auto-extract fields from template content using docthu.Template.variables()
            if not DocthuTemplate:
                return error_response("docthu library is not available"), 500

            try:
                tpl = DocthuTemplate(data["template"])
                template.fields = tpl.variables()
            except Exception as e:
                return error_response(f"Failed to extract fields: {str(e)}"), 400
        if "priority" in data:
            template.priority = data["priority"]

        await session.commit()
        await session.refresh(template)

        result_data = template.to_dict()
        result_data["template"] = template.template

        return success_response(result_data)


@bp.route("/api/templates/<int:id>", methods=["DELETE"])
@api_login_required
async def delete_template(id):
    """Delete a template."""
    async with AsyncSession() as session:
        result = await session.execute(select(Template).where(Template.id == id))
        template = result.scalar_one_or_none()

        if not template:
            return error_response("Template not found"), 404

        await session.delete(template)
        await session.commit()

        return success_response({"deleted": True})


@bp.route("/api/templates/<int:id>/test", methods=["POST"])
@api_login_required
async def test_template(id):
    """Test a template against a given email."""
    data = await request.get_json()
    email_id = data.get("email_id")

    if not email_id:
        return error_response("email_id is required"), 400

    async with AsyncSession() as session:
        # Get template
        result = await session.execute(select(Template).where(Template.id == id))
        template = result.scalar_one_or_none()

        if not template:
            return error_response("Template not found"), 404

        # Get email
        result = await session.execute(select(Email).where(Email.id == email_id))
        email = result.scalar_one_or_none()

        if not email:
            return error_response("Email not found"), 404

        # Parse email with template
        result = parse_email(template, email.body, email.content_type)

        if result:
            return success_response(result)
        else:
            return error_response("Template did not match or failed to parse"), 400


@bp.route("/api/emails/<int:email_id>/templates", methods=["GET"])
@api_login_required
async def get_matching_templates(email_id):
    """Get templates matching an email."""
    async with AsyncSession() as session:
        # Get email
        result = await session.execute(select(Email).where(Email.id == email_id))
        email = result.scalar_one_or_none()

        if not email:
            return error_response("Email not found"), 404

        # Find matching templates
        templates = await find_matching_templates(email.from_email)

        return success_response([t.to_dict() for t in templates])


@bp.route("/api/emails/<int:email_id>/reparse", methods=["POST"])
@api_login_required
async def reparse_email(email_id):
    """Re-parse an email."""
    from hopthu.app.services.parser import process_email

    result = await process_email(email_id)

    if "error" in result:
        return error_response(result["error"]), 400

    return success_response(result)
