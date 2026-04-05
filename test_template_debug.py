#!/usr/bin/env python3
"""Debug test script for template 2 parsing."""

import asyncio
from hopthu.app.db import AsyncSession
from hopthu.app.models import Template, Email
from hopthu.app.services.parser import parse_email
from sqlalchemy import select
import re


async def test_template_2_debug():
    async with AsyncSession() as session:
        result = await session.execute(select(Template).where(Template.id == 2))
        template = result.scalar_one_or_none()

        if not template:
            print("Template 2 not found")
            return

        print(f"Template ID: {template.id}")
        print(f"Fields: {template.fields}")

        result = await session.execute(
            select(Email).where(Email.from_email == template.from_email).limit(1)
        )
        email = result.scalar_one_or_none()

        if not email:
            print(f"No email found from {template.from_email}")
            return

        print(f"\n--- Email {email.id} ---")
        print(f"Content-Type: {email.content_type}")

        # Show a snippet of the actual email around the transaction date
        email_body = email.body

        # Find the transaction date in the email
        if "12:15" in email_body:
            idx = email_body.find("12:15")
            print(f"\nSnippet around '12:15' (found at index {idx}):")
            start = max(0, idx - 200)
            end = min(len(email_body), idx + 200)
            print(email_body[start:end])

        # Try to find pattern matches manually
        print("\n--- Checking for pattern matches ---")

        # Check if template patterns exist in email
        template_patterns = [
            ("transaction_datetime", r"\{\{transaction_datetime\}\}"),
            ("order_number", r"\{\{order_number\}\}"),
        ]

        for name, pattern in template_patterns:
            if re.search(pattern, template.template):
                print(f"Template has {{{{{name}}}}}")

        # Now try to extract using regex
        print("\n--- Manual regex extraction ---")

        # Try a simple regex for order number
        order_match = re.search(r'Số lệnh giao dịch.*?<td[^>]*colspan="3"[^>]*>(\d+)</td>', email_body, re.DOTALL)
        if order_match:
            print(f"Order number found: {order_match.group(1)}")
        else:
            print("Order number pattern not matched")

        # Try using the parser
        print("\n--- Using parse_email function ---")
        result = parse_email(template, email.body, email.content_type)
        print(f"Result: {result}")

        # Check if docthu is being used or fallback
        from hopthu.app.services.parser import extract_email
        print(f"\nUsing docthu: {extract_email is not None}")


if __name__ == "__main__":
    asyncio.run(test_template_2_debug())
