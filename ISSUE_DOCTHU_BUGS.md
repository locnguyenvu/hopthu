# Issue: Bugs and Limitations Found in docthu Library

**Repository:** https://github.com/locnguyenvu/docthu.git

**Date:** 2026-04-06

## Summary

While integrating `docthu` into the hopthu email processing system, I discovered several bugs and limitations that affect the reliability and usability of the library.

---

## Bug 1: Type Annotations in Assignments Not Supported

### Problem
The parser does not recognize type annotations in assignment syntax. When using `{% var:type = 'value' %}`, the assignment is silently ignored and not included in the variables list.

### Reproduction
```python
from docthu import Template

# This doesn't work - assignment is silently ignored
template1 = """
{% sender.bank_name:str = 'Vietcombank' %}
Date: {{date}}
"""
tpl1 = Template(template1)
print(tpl1.variables())
# Output: Only shows 'date', missing 'sender.bank_name'

# This works
template2 = """
{% sender.bank_name = 'Vietcombank' %}
Date: {{date}}
"""
tpl2 = Template(template2)
print(tpl2.variables())
# Output: Shows both 'sender.bank_name' and 'date'
```

### Expected Behavior
Type annotations should be supported in assignments, matching the syntax used in variable extraction:
```
{% amount:float = '100.50' %}  # Should work
{% count:int = '42' %}          # Should work
```

### Impact
- All static assignments always return `"type": "str"` regardless of the intended type
- Inconsistent API between extraction (`{{var:type}}`) and assignment (`{% var = 'value' %}`)

---

## Bug 2: Only String Literals Supported in Assignments

### Problem
The parser only recognizes assignment values that are quoted strings. Numeric literals, booleans, and other types are silently ignored.

### Reproduction
```python
from docthu import Template

template = """
{% int_val = 42 %}
{% float_val = 3.14 %}
{% bool_val = true %}
{% str_val = 'hello' %}
Date: {{date}}
"""

tpl = Template(template)
print(tpl.variables())
# Output: Only shows 'str_val' and 'date'
# Missing: int_val, float_val, bool_val
```

### Expected Behavior
Should support various literal types:
```python
{% tax_rate = 0.08 %}      # float
{% max_attempts = 3 %}      # int  
{% enabled = true %}        # bool
{% name = 'John' %}         # str
```

### Impact
- Users must wrap all values in quotes, even numeric values
- Type information is lost - everything becomes a string
- Requires manual type casting after extraction

---

## Bug 3: Inconsistency Between `docthu.variables()` and `Template.variables()`

### Problem
The convenience wrapper `docthu.variables(template)` returns only extract variables, while `Template(template).variables()` returns both extract and static_assign variables.

### Reproduction
```python
import docthu
from docthu import Template

template_text = """
{% sender = 'Vietcombank' %}
Date: {{date}}
Amount: {{amount:float}}
"""

# Using convenience wrapper
result1 = docthu.variables(template_text)
print(result1)
# Output: Only 'date' and 'amount' (extract kind)

# Using Template class
result2 = Template(template_text).variables()
print(result2)
# Output: 'sender', 'date', and 'amount' (all kinds)
```

### Expected Behavior
Both methods should return the same complete list of variables including both `extract` and `static_assign` kinds.

### Impact
- Confusing API - developers might use the wrong method
- Inconsistent behavior depending on import style
- Potential for bugs in applications that expect complete variable lists

---

## Bug 4: Silent Failures on Invalid Syntax

### Problem
When the parser encounters invalid or unsupported assignment syntax, it silently ignores the assignment without any warning or error. This makes debugging difficult.

### Reproduction
```python
from docthu import Template

# Invalid syntax - silently ignored
template = """
{% invalid syntax here %}
{% missing_quote = 'hello %}
{% no_equals 'value' %}
Date: {{date}}
"""

tpl = Template(template)
print(tpl.variables())
# Output: Only 'date' - no indication other assignments failed
```

### Expected Behavior
Should raise warnings or errors when:
- Assignment syntax is malformed
- Assignment cannot be parsed
- Value format is invalid

### Impact
- Difficult to debug template issues
- Silent data loss - assignments disappear without notice
- Poor developer experience

---

## Suggestions for Improvement

### 1. Support Type Annotations in Assignments
```python
# Allow type annotations to match extraction syntax
{% amount:float = '100.50' %}
{% count:int = '42' %}
{% date:datetime = '2024-01-01' %}
```

### 2. Support Non-String Literals
```python
# Allow numeric/boolean literals without quotes
{% tax_rate = 0.08 %}
{% max_attempts = 3 %}
{% enabled = true %}
```

### 3. Fix `docthu.variables()` Wrapper
Make `docthu.variables()` behave consistently with `Template.variables()`:
```python
def variables(template):
    """Return all variables including both extract and static_assign kinds."""
    return Template(template).variables()
```

### 4. Add Validation and Warnings
```python
# Raise warnings/errors for invalid syntax
{% invalid %}  # Warning: Invalid assignment syntax
{% var = %}    # Error: Missing value
```

### 5. Improve Documentation
- Document supported assignment syntax
- Clarify type annotation limitations
- Provide examples of valid/invalid assignments

---

## Environment

- **docthu version:** Latest from git (https://github.com/locnguyenvu/docthu.git)
- **Python version:** 3.x
- **OS:** Linux

---

## Priority

- **Bugs 1 & 2:** High - Affects core functionality and type safety
- **Bug 3:** Medium - API inconsistency is confusing but has workaround
- **Bug 4:** Medium - Affects developer experience but not functionality

---

## Contact

For questions or clarifications, please open an issue in the hopthu repository or contact the development team.
