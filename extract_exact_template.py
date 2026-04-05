#!/usr/bin/env python3
"""Extract exact HTML structure from email to create template."""

import asyncio
import re
from hopthu.app.db import AsyncSession
from hopthu.app.models import Template, Email
from sqlalchemy import select


async def extract_template():
    async with AsyncSession() as session:
        result = await session.execute(select(Template).where(Template.id == 2))
        template = result.scalar_one_or_none()

        result = await session.execute(
            select(Email).where(Email.from_email == template.from_email).limit(1)
        )
        email = result.scalar_one_or_none()

        # Find the transaction date table section
        body = email.body

        # Find the start of the table with transaction info
        # Look for "Ngày, giờ giao dịch" and extract from there
        start_marker = "Ngày, giờ giao dịch"
        end_marker = "Nội dung chuyển tiền"

        start_idx = body.find(start_marker)
        end_idx = body.find(end_marker)

        if start_idx == -1 or end_idx == -1:
            print(f"Could not find markers. start_idx={start_idx}, end_idx={end_idx}")
            return

        # Find the opening <tr> before the start marker
        # Go back to find <tr>
        search_start = max(0, start_idx - 500)
        snippet = body[search_start:start_idx + 500]

        print("Snippet around transaction date:")
        print(snippet)
        print("\n" + "="*80 + "\n")

        # Now extract from <tr> to </table> (end of table)
        # Find the <tr> that contains the date
        table_start_match = re.search(r'<tr>[^<]*<td[^>]*>[^<]*<b>Ngày, giờ giao dịch', body)
        if table_start_match:
            # Find the opening <tr>
            table_start = body.rfind('<tr>', 0, table_start_match.start())

            # Find the closing </table> after the narration
            table_end = body.find('</table>', end_idx)

            if table_start != -1 and table_end != -1:
                full_table = body[table_start:table_end + 8]  # +8 for '</table>'

                print("Full table HTML:")
                print(full_table[:2000])
                print("\n... [truncated] ...")


if __name__ == "__main__":
    asyncio.run(extract_template())
