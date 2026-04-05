#!/usr/bin/env python3
"""Update Template 2 with proper variable placeholders."""

import asyncio
from hopthu.app.db import AsyncSession
from hopthu.app.models import Template
from sqlalchemy import select


async def update_template_2():
    async with AsyncSession() as session:
        result = await session.execute(select(Template).where(Template.id == 2))
        template = result.scalar_one_or_none()

        if not template:
            print("Template 2 not found")
            return

        # Create a new template with variable placeholders
        # This is a simplified HTML template focusing on the key data fields
        new_template = """<html lang="vi">
  <head>
    <meta charset="UTF-8">
    <title>Vietcombank</title>
  </head>
  <body>
    <table>
      <tr>
        <td><b>Ngày, giờ giao dịch</b><br><i>Trans. Date, Time</i></td>
        <td>{{transaction_datetime}}</td>
      </tr>
      <tr>
        <td><b>Số lệnh giao dịch</b><br><i>Order Number</i></td>
        <td>{{order_number}}</td>
      </tr>
      <tr>
        <td><b>Tài khoản nguồn</b><br><i>Debit Account</i></td>
        <td>{{debit_account}}</td>
      </tr>
      <tr>
        <td><b>Tên người chuyển tiền</b><br><i>Remitter's name</i></td>
        <td>{{remitter_name}}</td>
      </tr>
      <tr>
        <td><b>Tài khoản người hưởng</b><br><i>Credit Account</i></td>
        <td>{{credit_account}}</td>
      </tr>
      <tr>
        <td><b>Tên người hưởng</b><br><i>Beneficiary Name</i></td>
        <td>{{beneficiary_name}}</td>
      </tr>
      <tr>
        <td><b>Tên ngân hàng hưởng</b><br><i>Beneficiary Bank Name</i></td>
        <td>{{beneficiary_bank}}</td>
      </tr>
      <tr>
        <td><b>Số tiền</b><br><i>Amount</i></td>
        <td>{{amount}}</td>
      </tr>
      <tr>
        <td><b>Loại phí</b><br><i>Charge Code</i></td>
        <td>{{charge_code}}</td>
      </tr>
      <tr>
        <td><b>Nội dung chuyển tiền</b><br><i>Details of Payment</i></td>
        <td>{{narration}}</td>
      </tr>
    </table>
  </body>
</html>"""

        # Fields to extract
        fields = [
            "transaction_datetime",
            "order_number",
            "debit_account",
            "remitter_name",
            "credit_account",
            "beneficiary_name",
            "beneficiary_bank",
            "amount",
            "charge_code",
            "narration",
        ]

        # Update the template
        template.template = new_template
        template.fields = fields

        await session.commit()

        print("Template 2 updated successfully!")
        print(f"Fields: {fields}")
        print(f"\nNew template:\n{new_template}")


if __name__ == "__main__":
    asyncio.run(update_template_2())
