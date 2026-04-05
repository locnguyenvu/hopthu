# Template Handling Knowledge

## Overview

Templates in hopthu use the **docthu** library for parsing emails and extracting structured data. Templates contain both extractable variables (`{{field}}`) and static variable assignments (`{% var = 'value' %}`).

## Template Format

### Variable Extraction Markers
```
{{field_name}}           → extracts string value
{{field_name:type}}      → extracts typed value (str, int, float, date, datetime)
```

### Static Variable Assignments
```
{% sender.bank_name = 'Vietcombank' %}
{% receiver.account_id: str = "MD091775366138382X5" %}
```

- Variable names can use dot notation for nested structures (e.g., `sender.bank_name`)
- Values must be quoted with single quotes
- Type annotation is optional (defaults to `str`)

### Example Template
```html
{% sender.bank_name = 'Vietcombank' %}
<html>
<body>
Date: {{date}}
Account: {{sender.account}}
</body>
</html>
```

## Database Schema

### Templates Table
| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| from_email | String | Email sender to match |
| subject | String | Optional subject match |
| content_type | String | text/plain or text/html |
| template | Text | Full template with assignments |
| fields | JSON | Simple list of field names |
| priority | Integer | Optional priority for matching |

## Template Format

### 1. Single Newline After Assignments
When prepending variable assignments to a template, use **exactly one newline**:

✅ **Correct:**
```
{% sender.bank_name = 'Vietcombank' %}
<html>
```

❌ **Incorrect:**
```
{% sender.bank_name = 'Vietcombank' %}

<html>
```

**Reason:** docthu's tokenizer absorbs the newline after assignments. Double newlines leave an extra `\n` in the literal token, causing pattern mismatch.

### 2. Variable Names Can Contain Dots
Regex patterns must use `[\w.]+` not `\w+`:
```python
# Correct
re.compile(r'{%\s*([\w.]+)\s*=\s*\'([^\']*)\'\s*%\}')

# Wrong - won't match sender.bank_name
re.compile(r'{%\s*(\w+)\s*=\s*\'([^\']*)\'\s*%\}')
```

### 3. docthu Handles Assignments Internally
- The docthu tokenizer **automatically strips** `AssignmentToken` when compiling the matching pattern
- No need to manually strip assignments before parsing
- Assignments are merged into the result dict after extraction

### 4. Template Must Match Email Structure
- Static text in template must exactly match the email body (with flexible whitespace)
- The template starts with `<html>` for HTML emails, not the assignment line
- Assignments are metadata that don't affect matching

## Parsing Flow

```
1. Load template from database (with assignments)
2. docthu tokenizes template → LiteralToken, VariableToken, AssignmentToken
3. compile_tokens() strips AssignmentTokens, builds regex from remaining tokens
4. Regex matches against email body
5. Extracted values + static assignments merged into result dict
6. Result: {"date": "...", "sender": {"bank_name": "Vietcombank"}}
```

## API Endpoints

### Create/Update Template
```json
{
  "from_email": "sender@example.com",
  "subject": "Optional",
  "content_type": "text/html",
  "template": "{% var = 'value' %}\n<html>...",
  "fields": ["var", "other"]
}
```

### Parse Email
```python
from hopthu.app.services.parser import parse_email, process_email

# Single parse
result = parse_email(template_obj, email_body, content_type)
# Returns: {"field": "value", ...} or None

# Full process (find matching template, extract, save)
result = await process_email(email_id)
# Returns: {"success": True, "template_id": 1, "data": {...}}
```

## Frontend Editor

### State Management
- `extractedFields` - array of fields parsed from `{{field_name}}` or `{{field_name:type}}` markers
- `variableAssignments` - array of variables parsed from `{% var_name:type = value %}` blocks

### Save Logic
```javascript
// Build assignments section
const varSection = assignments.map(v =>
  `{% ${v.name}:${v.type} = ${v.value} %}`
).join('\n') + '\n';  // Single newline!

const data = {
  template: varSection + template.template,
  fields: extractedFields.map(f => f.name),
};
```

### Load Logic
1. Parse `{% ... %}` blocks from template text to extract variable assignments
2. Parse `{{...}}` markers from template text to extract fields
3. Strip assignment lines from editable template text

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Message does not match template" | Double newline after assignments | Use single `\n` |
| Assignment not parsed | Regex missing dot support | Use `[\w.]+` pattern |
| Duplicate variables | Missing name uniqueness check | Check before add |
