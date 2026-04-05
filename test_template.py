#!/usr/bin/env python3
"""Test script for template 2 parsing."""

import asyncio
from hopthu.app.db import AsyncSession
from hopthu.app.models import Template, Email
from hopthu.app.services.parser import parse_email
from sqlalchemy import select


async def test_template_2():
    async with AsyncSession() as session:
        # Get template 2
        result = await session.execute(select(Template).where(Template.id == 2))
        template = result.scalar_one_or_none()

        if not template:
            print("Template 2 not found")
            return

        print(f"Template ID: {template.id}")
        print(f"From Email: {template.from_email}")
        print(f"Subject: {template.subject}")
        print(f"Content Type: {template.content_type}")
        print(f"Template:\n{template.template}")
        print(f"Fields: {template.fields}")

        # Find an email from the same sender + subject
        from sqlalchemy import and_
        query = select(Email).where(
            and_(
                Email.from_email == template.from_email,
                Email.subject == template.subject,
            )
        ).limit(1)
        result = await session.execute(query)
        email = result.scalar_one_or_none()

        if email:
            print(f"\n--- Testing with email {email.id} ---")
            print(f"Email body preview: {email.body[:200]}...")

            result = parse_email(template, email.body, email.content_type)
            print(f"\nParsed result: {result}")
        else:
            print(f"\nNo email found from {template.from_email}")


if __name__ == "__main__":
    asyncio.run(test_template_2())
