#!/usr/bin/env python3
"""Update Template 2 with proper variable placeholders matching actual email HTML."""

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

        # Create a template that matches the actual HTML structure
        # Using the real email HTML with variables in the right places
        new_template = """<b>Ngày, giờ giao dịch</b><br>
                                  <i>Trans. Date, Time</i>
                                </td>
                                <td colspan="3"
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{transaction_datetime}}
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Số lệnh giao dịch</b><br>
                                  <i>Order Number</i>
                                </td>
                                <td colspan="3"
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{order_number}}
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Tài khoản nguồn</b><br>
                                  <i>Debit Account</i>
                                </td>
                                <td colspan="3"
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{debit_account}}
                                </td>
                              </tr>
                              <tr>
                                                          <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Tên người chuyển tiền</b><br>
                                  <i>Remitter's name</i>
                                </td>
                                <td colspan="3"
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{remitter_name}}
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Tài khoản người hưởng</b><br>
                                  <i>Credit Account</i>
                                </td>
                                <td colspan="3"
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{credit_account}}
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Tên người hưởng</b><br>
                                  <i>Beneficiary Name</i>
                                </td>
                                <td colspan="3"
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{beneficiary_name}}
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Tên ngân hàng hưởng</b><br>
                                  <i>Beneficiary Bank Name</i>
                                </td>
                                <td colspan="3"
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{beneficiary_bank}}
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Số tiền</b><br>
                                  <i>Amount</i>
                                </td>
                                <td colspan="3"
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{amount:float}} {{currency}}
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Loại phí</b><br>
                                  <i>Charge Code</i>
                                </td>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{charge_code}}<br>
                                  <i>Exclude </i>
                                </td>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Số tiền phí</b><br>
                                  <i>Charge Amount<br>Net income<br>VAT</i>
                                </td>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{charge_amount}}<br>&nbsp;<br>0
                                  VND<br>0 VND
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  <b>Nội dung chuyển tiền</b><br>
                                  <i>Details of Payment</i>
                                </td>
                                <td colspan="3"
                                  style="font-family:'SF Pro Text',Arial,sans-serif;border-collapse:collapse;word-break:break-word;font-size:14px;border-top:1px solid #c5c5c5;border-right:1px solid #c5c5c5;border-bottom:1px solid #c5c5c5;border-left:1px solid #c5c5c5;padding:5px 10px 5px 10px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                                  {{narration}}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            style="padding:0px 0px 30px 0px;mso-table-lspace:0pt;mso-table-rspace:0pt;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"
                            border="0" align="left">
                            <p
                              style="font-family:'SF Pro Text','Arial',sans-serif;font-size:16px;line-height:24px;text-align:center;margin:0px;color:#4a4a4a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
                              <b>Cám ơn Quý khách đã sử dụng dịch vụ của Vietcombank!</b><br><i>Thank you for banking
                                with
                                Vietcombank!</i>
                            </p>
                          </td>
                        </tr>"""

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
            "currency",
            "charge_code",
            "charge_amount",
            "narration",
        ]

        # Update the template
        template.template = new_template
        template.fields = fields

        await session.commit()

        print("Template 2 updated successfully!")
        print(f"Fields: {fields}")


if __name__ == "__main__":
    asyncio.run(update_template_2())
