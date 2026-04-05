# `stop_on_filled` still requires static text after the stop point to match

## Description

When using `stop_on_filled`, the parser still fails if static text **after** the specified stop variable doesn't match the message. The expected behavior is that once all `stop_on_filled` variables are filled, the engine should stop and not care about trailing static text.

## Reproduction

```python
from docthu import parse

template = '''<html>
<body>
<table>
<tr><td>Số hoá đơn</td><td>{{receipt_number}}</td></tr>
<tr><td>Ngày giao dịch</td><td>17:19 07/04/2026</td></tr>
<tr><td>Từ tài khoản</td><td>609704060064067</td></tr>
<tr><td>Đến tài khoản</td><td>38876248999 - TRAN THI BE</td></tr>
<tr><td>Tại ngân hàng</td><td>TPBank</td></tr>
<tr><td>Số tiền</td><td>25,000 ₫</td></tr>
</table>
</body>
</html>'''

message = '''<html>
<body>
<table>
<tr><td>Số hoá đơn</td><td>6095VNIB02YGP3BS</td></tr>
<tr><td>Ngày giao dịch</td><td>11:23 05/04/2026</td></tr>
<tr><td>Từ tài khoản</td><td>609704060064067</td></tr>
<tr><td>Đến tài khoản</td><td>VQRQAICAN1118 - WINCOMMERCE JSC</td></tr>
<tr><td>Tại ngân hàng</td><td>Quân đội</td></tr>
<tr><td>Số tiền</td><td>194,579 ₫</td></tr>
</table>
</body>
</html>'''

# Template has only one extract variable: receipt_number
# The rest (date, account, bank, amount) are hardcoded static text in the template
# The message has different values for those static fields

result = parse(template, message, stop_on_filled=['receipt_number'])
print(result)
```

### Expected

```python
{'receipt_number': '6095VNIB02YGP3BS'}
```

Since `receipt_number` is the only variable in `stop_on_filled`, the engine should:
1. Find `receipt_number` in the message → captured
2. Stop parsing — no need to verify trailing static text

### Actual

```
docthu.matcher.MatchError: Message does not match the template.
Check that the template's static text matches the message.
```

The parser fails because static text like `17:19 07/04/2026`, `TPBank`, `25,000 ₫` in the template doesn't match the corresponding values in the message (`11:23 05/04/2026`, `Quân đội`, `194,579 ₫`).

## Use Case

I'm building email templates from a sample email. The template captures only the fields I care about (e.g., `receipt_number`). Other fields in the email (date, amount, bank name) vary per transaction but I don't need to extract them. With `stop_on_filled`, I expect the parser to:

1. Match the static text **before** the first extract variable
2. Capture the specified variables
3. **Stop** — ignore everything after

This would let me create "partial" templates that only need the static text around the variables I care about, without requiring every single data field to be templated.

## Environment

- docthu: latest (from git `https://github.com/locnguyenvu/docthu.git`)
- Python: 3.13
