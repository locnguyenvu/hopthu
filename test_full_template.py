#!/usr/bin/env python3
"""Test the full template against the actual email."""

import asyncio
from hopthu.app.db import AsyncSession
from hopthu.app.models import Template, Email
from sqlalchemy import select
from docthu import parse


async def test_full():
    async with AsyncSession() as session:
        result = await session.execute(select(Template).where(Template.id == 2))
        template = result.scalar_one_or_none()

        result = await session.execute(
            select(Email).where(Email.from_email == template.from_email).limit(1)
        )
        email = result.scalar_one_or_none()

        print("Testing with actual template and email...")
        print(f"Template length: {len(template.template)}")
        print(f"Email body length: {len(email.body)}")

        # Try parsing
        try:
            result = parse(template.template, email.body)
            print(f"\nSuccess! Result: {result}")
        except Exception as e:
            print(f"\nError: {e}")

            # Try to find where the mismatch is
            # Test with just the first row
            template_start = template.template[:500]
            email_start = email.body[12000:12500]  # Around where the table should be

            print(f"\nTemplate start (first 500 chars):\n{template_start}")
            print(f"\nEmail snippet (around index 12000):\n{email_start}")


if __name__ == "__main__":
    asyncio.run(test_full())
