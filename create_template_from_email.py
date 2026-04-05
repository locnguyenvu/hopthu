#!/usr/bin/env python3
"""Create template by extracting exact HTML from email and inserting variables."""

import asyncio
import re
from hopthu.app.db import AsyncSession
from hopthu.app.models import Template, Email
from sqlalchemy import select


async def create_template_from_email():
    async with AsyncSession() as session:
        result = await session.execute(select(Template).where(Template.id == 2))
        template = result.scalar_one_or_none()

        result = await session.execute(
            select(Email).where(Email.from_email == template.from_email).limit(1)
        )
        email = result.scalar_one_or_none()

        body = email.body

        # Find the table section
        start_marker = '<td width="200"'
        start_idx = body.find(start_marker)

        # Find the end of the table
        end_marker = '</table>'
        # Find the </table> after the narration row
        narration_idx = body.find('Nội dung chuyển tiền')
        end_idx = body.find(end_marker, narration_idx)

        if start_idx == -1 or end_idx == -1:
            print(f"Could not find markers. start_idx={start_idx}, narration_idx={narration_idx}, end_idx={end_idx}")
            return

        # Find the opening <tr> before start_idx
        table_start = body.rfind('<tr>', 0, start_idx)
        table_end = end_idx + len(end_marker)

        # Extract the full table section
        full_table = body[table_start:table_end]

        print("Extracted table HTML (first 3000 chars):")
        print(full_table[:3000])
        print("\n...\n")

        # Now create template by replacing actual values with variables
        template_html = full_table

        # Replace transaction datetime
        template_html = re.sub(
            r'(<td colspan="3"[^>]*style="[^"]*border-top:1px solid #c5c5c5[^"]*"[^>]*>)\s*\d{2}:\d{2}[^<]+</td>',
            r'\1{{transaction_datetime}}</td>',
            template_html
        )

        # Replace order number
        template_html = re.sub(
            r'(Số lệnh giao dịch.*?</td>\s*<td colspan="3"[^>]*style="[^"]*border-top:1px solid #c5c5c5[^"]*"[^>]*>)\s*\d+\s*</td>',
            r'\1{{order_number}}</td>',
            template_html,
            flags=re.DOTALL
        )

        # Replace debit account
        template_html = re.sub(
            r'(Tài khoản nguồn.*?</td>\s*<td colspan="3"[^>]*style="[^"]*border-top:1px solid #c5c5c5[^"]*"[^>]*>)\s*\d+\s*</td>',
            r'\1{{debit_account}}</td>',
            template_html,
            flags=re.DOTALL
        )

        # Replace remitter name
        template_html = re.sub(
            r'(Tên người chuyển tiền.*?</td>\s*<td colspan="3"[^>]*style="[^"]*border-top:1px solid #c5c5c5[^"]*"[^>]*>)\s*[^<]+\s*</td>',
            r'\1{{remitter_name}}</td>',
            template_html,
            flags=re.DOTALL
        )

        # Replace credit account
        template_html = re.sub(
            r'(Tài khoản người hưởng.*?</td>\s*<td colspan="3"[^>]*style="[^"]*border-top:1px solid #c5c5c5[^"]*"[^>]*>)\s*[A-Z0-9]+\s*</td>',
            r'\1{{credit_account}}</td>',
            template_html,
            flags=re.DOTALL
        )

        # Replace beneficiary name
        template_html = re.sub(
            r'(Tên người hưởng.*?</td>\s*<td colspan="3"[^>]*style="[^"]*border-top:1px solid #c5c5c5[^"]*"[^>]*>)\s*[^<]+\s*</td>',
            r'\1{{beneficiary_name}}</td>',
            template_html,
            flags=re.DOTALL
        )

        # Replace beneficiary bank
        template_html = re.sub(
            r'(Tên ngân hàng hưởng.*?</td>\s*<td colspan="3"[^>]*style="[^"]*border-top:1px solid #c5c5c5[^"]*"[^>]*>)\s*[^<]+\s*</td>',
            r'\1{{beneficiary_bank}}</td>',
            template_html,
            flags=re.DOTALL
        )

        # Replace amount and currency
        template_html = re.sub(
            r'(Số tiền.*?</td>\s*<td colspan="3"[^>]*style="[^"]*border-top:1px solid #c5c5c5[^"]*"[^>]*>)\s*([0-9,]+)\s*([A-Z]+)\s*</td>',
            r'\1{{amount:float}} {{currency}}</td>',
            template_html,
            flags=re.DOTALL
        )

        # Replace narration
        template_html = re.sub(
            r'(Nội dung chuyển tiền.*?</td>\s*<td colspan="3"[^>]*style="[^"]*border-top:1px solid #c5c5c5[^"]*"[^>]*>)\s*[^<]+\s*</td>',
            r'\1{{narration}}</td>',
            template_html,
            flags=re.DOTALL
        )

        print("=" * 80)
        print("Template HTML (with variables):")
        print(template_html[:4000])
        print("\n...\n")

        # Update the template
        fields = [
            "transaction_datetime",
            "order_number",
            "debit_account",
            "remitter_name",
            "credit_account",
            "beneficiary_name",
            "beneficiary_bank",
            "amount",
            "currency",
            "narration",
        ]

        template.template = template_html
        template.fields = fields

        await session.commit()

        print(f"Template 2 updated successfully!")
        print(f"Fields: {fields}")


if __name__ == "__main__":
    asyncio.run(create_template_from_email())
