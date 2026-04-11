# hopthu — Phase 3: Triggers & External Integrations

> Continues from [init.md](./docs/plan/init.md) (Phases 1 & 2).

---

## 3.1 Overview

When an email is successfully extracted (status → `extracted`), the system can fire HTTP requests to external systems. This is split into two entities:

- **Connection** — defines *where* to send: endpoint URL, HTTP method, headers (with encrypted values for API tokens). Reusable across multiple triggers.
- **Trigger** — defines *what* to send and *when*: tied to a template, maps source data fields to a request payload structure, references a connection.

**Data flow:** Email synced → parser extracts data → trigger fires → system builds request payload from field mappings → sends HTTP request using the connection details → logs the execution result.

---

## 3.2 Database Models

Add the following models to `models.py` and generate a new Alembic migration:

```bash
uv run alembic revision --autogenerate -m "add connections triggers and trigger logs"
uv run alembic upgrade head
```

```python
class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    endpoint = Column(String, nullable=False)              # URL to send request to
    method = Column(String, nullable=False, default="POST")  # POST | GET | PUT
    headers = Column(JSON, nullable=False, default=list)   # [{ "key": "...", "value": "...", "encrypted": false }]
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    triggers = relationship("Trigger", back_populates="connection")


class Trigger(Base):
    __tablename__ = "triggers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="CASCADE"), nullable=False)
    connection_id = Column(Integer, ForeignKey("connections.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    body_template = Column(JSON, nullable=False, default=dict)  # JSON structure of the request body
    field_mappings = Column(JSON, nullable=False, default=list)
    # [{ "source": "extracted_data.amount", "target": "payment.value" },
    #  { "source": "meta_data.received_at", "target": "timestamp" }]
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    template = relationship("Template", backref="triggers")
    connection = relationship("Connection", back_populates="triggers")


class TriggerLog(Base):
    __tablename__ = "trigger_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trigger_id = Column(Integer, ForeignKey("triggers.id", ondelete="CASCADE"), nullable=False)
    email_id = Column(Integer, ForeignKey("emails.id", ondelete="CASCADE"), nullable=False)
    request_url = Column(String, nullable=False)
    request_method = Column(String, nullable=False)
    request_headers = Column(JSON, nullable=False, default=dict)  # headers sent (secrets masked)
    request_body = Column(JSON, nullable=False, default=dict)     # actual payload sent
    response_status = Column(Integer, nullable=True)              # HTTP status code
    response_body = Column(Text, nullable=True)                   # response body (truncated)
    status = Column(String, nullable=False, default="pending")    # pending | success | failed
    executed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    trigger = relationship("Trigger")
    email = relationship("Email")
```

**Notes on the models:**

- **Connection** owns the external API details: endpoint, method, headers. Multiple triggers can reference the same connection. Header values with `encrypted: true` are stored via `config.encrypt_credential()`, decrypted at request time, and masked in API responses as `"••••••"`.
- **Trigger** owns the data mapping: which template it listens to, which connection to use, and how to build the payload. `body_template` is the JSON skeleton, `field_mappings` maps source fields to target paths.
- `field_mappings` is a list of `{ source, target }` pairs. `source` uses dot-path into two namespaces: `extracted_data.<field>` or `meta_data.<field>`. `target` uses dot-path into the `body_template` structure.
- **TriggerLog** records every execution attempt. `request_url`, `request_method`, and `request_headers` are copied from the connection at execution time (so logs remain accurate even if the connection is later changed). Secrets in headers are masked before logging.

---

## 3.3 Payload Builder

The payload builder takes the `body_template`, `field_mappings`, and the source data, then produces the final request JSON.

**How it works:**

1. Start with a deep copy of `body_template` as the base payload.
2. For each mapping in `field_mappings`:
   - Resolve the `source` path: split by `.`, first segment is the namespace (`extracted_data` or `meta_data`), remaining segments navigate into the source data.
   - Resolve the `target` path: split by `.`, navigate into the payload, set the value at the final key.
3. Return the fully populated payload.

**Example:**

Source data:
```json
{
  "meta_data": { "received_at": "2026-04-09T10:00:00+07:00" },
  "extracted_data": { "sender": { "bank": "VCB" }, "amount": "500000" }
}
```

Trigger config:
```json
{
  "body_template": { "sender": { "bank_name": "" }, "payment": { "value": "", "date": "" } },
  "field_mappings": [
    { "source": "extracted_data.sender.bank", "target": "sender.bank_name" },
    { "source": "extracted_data.amount", "target": "payment.value" },
    { "source": "meta_data.received_at", "target": "payment.date" }
  ]
}
```

Result payload:
```json
{
  "sender": { "bank_name": "VCB" },
  "payment": { "value": "500000", "date": "2026-04-09T10:00:00+07:00" }
}
```

**Instructions:**
1. Build `services/trigger.py` with:
   - `def resolve_source_value(source_path: str, extracted_data: dict, meta_data: dict) -> any` — navigates the dot-path, returns the value or `None` if path doesn't exist.
   - `def build_payload(body_template: dict, field_mappings: list, extracted_data: dict, meta_data: dict) -> dict` — deep copies the template, applies all mappings, returns the populated payload.
   - `async def execute_trigger(trigger: Trigger, email_data: EmailData, email: Email) -> TriggerLog` — resolves the connection, builds the payload, decrypts header secrets, sends the HTTP request via `aiohttp`, logs the result.
   - `async def run_triggers_for_email(email_id: int)` — find all active triggers for the email's matched template, execute each, log results.
2. Integrate into the extraction flow: after `process_email()` successfully extracts data, call `run_triggers_for_email()`.

---

## 3.4 Connection Endpoints

| Method | Path                                  | Description                              |
|--------|---------------------------------------|------------------------------------------|
| GET    | `/api/connections`                    | List all connections                     |
| POST   | `/api/connections`                    | Create a new connection                  |
| GET    | `/api/connections/<id>`               | Get connection detail                    |
| PUT    | `/api/connections/<id>`               | Update a connection                      |
| DELETE | `/api/connections/<id>`               | Delete a connection                      |
| POST   | `/api/connections/<id>/test`          | Test connection (send a test request)    |

**Create connection flow:**

1. User fills in: name, endpoint URL, HTTP method, headers (with option to mark values as encrypted).
2. Save.

**Test connection flow:**
- `POST /api/connections/<id>/test` sends a request to the endpoint with the configured method and headers (no body). Returns the response status and body. Useful for verifying the endpoint is reachable and API tokens are valid.

**Instructions:**
1. Implement `routes/connections.py`.
2. On create/update: encrypt any header values marked as `encrypted` via `config.encrypt_credential()`.
3. On GET responses: mask encrypted header values as `"••••••"` — never return the decrypted value.
4. On delete: block if any triggers reference this connection (return 409 Conflict), or let the user confirm cascade.

---

## 3.5 Trigger Endpoints

| Method | Path                                  | Description                              |
|--------|---------------------------------------|------------------------------------------|
| GET    | `/api/triggers`                       | List all triggers                        |
| POST   | `/api/triggers`                       | Create a new trigger                     |
| GET    | `/api/triggers/<id>`                  | Get trigger detail                       |
| PUT    | `/api/triggers/<id>`                  | Update a trigger                         |
| DELETE | `/api/triggers/<id>`                  | Delete a trigger                         |
| POST   | `/api/triggers/<id>/test`             | Test trigger with a given email_data     |
| GET    | `/api/triggers/<id>/logs`             | List execution logs for a trigger        |
| GET    | `/api/templates/<id>/triggers`        | List triggers for a template             |

**Create trigger flow:**

1. User selects a template to attach the trigger to.
2. User selects a connection (or creates a new one inline).
3. User defines the body template as a JSON structure.
4. User maps source fields (from template's `fields` list + email `meta_data` keys) to target paths in the body template.
5. Save.

**Test trigger flow:**
- `POST /api/triggers/<id>/test` accepts `{ email_id: int }`.
- System fetches the `email_data` for that email, builds the payload using the trigger's mappings, sends the request using the trigger's connection, and returns both the built payload and the response (status + body). Does not create a log entry. If no `email_data` exists, return an error.

**Instructions:**
1. Implement `routes/triggers.py`.
2. The test endpoint skips logging for now.

---

## 3.6 Frontend — Phase 3

**New routes:**

| Route                      | View               | Description                          |
|----------------------------|--------------------|--------------------------------------|
| `/connections`             | Connection List    | All connections                      |
| `/connections/new`         | Connection Editor  | Create connection                    |
| `/connections/:id`         | Connection Editor  | Edit existing connection             |
| `/triggers`                | Trigger List       | All triggers                         |
| `/triggers/new`            | Trigger Editor     | Create trigger                       |
| `/triggers/:id`            | Trigger Editor     | Edit existing trigger                |
| `/triggers/:id/logs`       | Trigger Logs       | Execution history for a trigger      |

**Connection editor UI:**

1. Name input.
2. Endpoint URL input.
3. HTTP method dropdown (POST/GET/PUT).
4. Headers section: dynamic key-value rows. Each row has: key input, value input, and an "encrypted" toggle. When encrypted is on, the value input behaves like a password field. Existing encrypted values show as `"••••••"` — submitting without changing leaves the encrypted value intact.
5. "Test Connection" button: fires the test endpoint, shows response status.
6. Save button.

**Connection list view:**
1. Table: name, endpoint, method, trigger count (how many triggers use this connection).
2. Click to edit. Delete with confirmation (blocked if triggers reference it).

**Trigger editor UI:**

1. **Basic info:** Name, template selector (dropdown — selecting a template loads its `fields` list as available source fields), connection selector (dropdown of existing connections), active toggle.
2. **Body template section:** A JSON editor (textarea) where the user defines the request body structure. Validate that it's valid JSON on save.
3. **Field mappings section:** A table of mapping rows. Each row has:
   - Source: a dropdown populated with `extracted_data.<field>` for each field in the selected template's `fields`, plus `meta_data.received_at` (and any other meta_data keys).
   - Target: a text input for the dot-path into the body template. Could offer autocomplete based on the body template's structure.
   - Add/remove row buttons.
4. **Test button:** Pick an email (that has been extracted by the selected template), fire the test, show the built payload and the response side-by-side.
5. **Save button.**

**Trigger list view:**
1. Table: name, template (`from_email` + `subject`), connection name, active toggle, last execution status.
2. Click to edit. Delete with confirmation.

**Trigger logs view:**
1. Table: email subject, executed_at, status (success/failed), response status code.
2. Click a row to expand: show full request payload, response body.

**Updates to existing views:**

1. **Template detail / list** — show trigger count per template. Link to associated triggers.
2. **Email detail view** — if the email has been extracted and triggers exist, show a "Trigger Logs" section with execution history for this email.
3. **Sidebar** — add "Connections" and "Triggers" links in the navigation.

---

## Step-by-Step Build Order (Phase 3)

Each step below is a self-contained unit. Complete it fully (tests pass, feature works) before starting the next.

**Step 15: Connection + Trigger + TriggerLog models + migration**
- RED: Write a test that runs `alembic upgrade head` and confirms the `connections`, `triggers`, and `trigger_logs` tables exist with correct columns and foreign keys. Test that `triggers.connection_id` references `connections.id`. Test that `triggers.template_id` references `templates.id`.
- GREEN: Add `Connection`, `Trigger`, and `TriggerLog` models to `models.py`. Generate migration: `uv run alembic revision --autogenerate -m "add connections triggers and trigger logs"`. Apply: `uv run alembic upgrade head`.
- VERIFY: `uv run pytest` passes. Migration applies cleanly. FK constraints work (inserting a trigger with invalid `connection_id` or `template_id` fails).

**Step 16: Connection CRUD endpoints (backend)**
- RED: Write tests for all connection endpoints: create (with encrypted headers stored correctly), read (encrypted values masked as `"••••••"`), update (changing non-encrypted fields keeps encrypted values intact), delete (blocked when triggers reference it), list. Test `POST /api/connections/<id>/test` — mock HTTP, verify it sends request with decrypted headers and returns response.
- GREEN: Implement `routes/connections.py` with all endpoints.
- VERIFY: All connection tests pass. Encrypted header values never appear in GET responses.

**Step 17: Connection management (frontend)**
- Build connection editor view: name, endpoint, method, headers with encrypted toggle, test button.
- Build connection list view: table with name, endpoint, method, trigger count.
- Add "Connections" link to sidebar.
- VERIFY: Can create a connection with encrypted headers, test it, edit it, see it in the list. Delete blocked when triggers use it.

**Step 18: Payload builder (backend)**
- RED: Write tests for `resolve_source_value()` — test navigating nested dot-paths in both `extracted_data` and `meta_data`, test missing path returns `None`. Write tests for `build_payload()` — test that the body template is populated correctly from mappings, test nested targets, test that unmapped fields keep their template defaults, test deep copy (original template not mutated).
- GREEN: Implement `resolve_source_value()` and `build_payload()` in `services/trigger.py`.
- VERIFY: All payload builder tests pass.

**Step 19: Trigger execution (backend)**
- RED: Write tests for `execute_trigger()` — mock `aiohttp` outgoing request. Test it resolves the connection, uses its endpoint/method/headers. Test successful request creates a log with `status: "success"` and correct `response_status`. Test failed request (connection error, non-2xx) creates a log with `status: "failed"`. Test that encrypted header values from the connection are decrypted before sending. Test that logged headers have secrets masked.
- GREEN: Implement `execute_trigger()` and `run_triggers_for_email()` in `services/trigger.py`.
- VERIFY: All execution tests pass. Secrets are never logged in plain text.

**Step 20: Wire triggers into extraction flow (backend)**
- RED: Write an integration test: create a connection, a template, and a trigger linking them. Insert an email, run `process_email()` — verify that after successful extraction, the trigger fires (mock HTTP) using the connection's endpoint, and a `TriggerLog` entry is created. Test that triggers don't fire when extraction fails. Test that inactive triggers (`is_active=False`) are skipped. Test that two triggers on different templates can share the same connection.
- GREEN: Wire `run_triggers_for_email()` into `process_email()` in `services/parser.py` — call it after successful extraction.
- VERIFY: All integration tests pass. The full chain works: sync → extract → trigger.

**Step 21: Trigger CRUD endpoints (backend)**
- RED: Write tests for all trigger endpoints: create (referencing a connection and template), read, update, delete, list, list by template. Test `POST /api/triggers/<id>/test` — mock HTTP, verify it returns built payload and response without creating a persistent log.
- GREEN: Implement `routes/triggers.py` with all endpoints. Add `GET /api/triggers/<id>/logs` for log listing.
- VERIFY: All trigger endpoint tests pass.

**Step 22: Trigger editor (frontend)**
- Build trigger editor view: basic info (name, template selector, connection selector, active toggle), body template JSON editor, field mappings table (source dropdown from template fields + meta_data, target text input).
- Build trigger list view: table with name, template, connection name, active toggle.
- VERIFY: Can create a trigger, select a connection, write a body template, add field mappings, save. Can edit and delete triggers.

**Step 23: Trigger testing + logs (frontend)**
- Add "Test" button to trigger editor: pick an email, fire test, display built payload and response side-by-side.
- Build trigger logs view: table with execution history, expandable rows showing full request/response.
- Update email detail view: add "Trigger Logs" section showing execution history for this email.
- Update template list/detail: show trigger count, link to associated triggers.
- Add "Triggers" link to sidebar.
- VERIFY: Full Phase 3 flow works end-to-end: create connection → create trigger for a template using that connection → define mappings → test with an extracted email → see built payload and response → sync a new email → extraction succeeds → trigger fires automatically → log entry appears in trigger logs and email detail. Verify two triggers sharing the same connection both work correctly.

**Step 23 is the Phase 3 milestone.** Verify the complete flow: everything from Phase 1 and 2 still works, plus connection management → trigger creation → field mapping → testing → automatic execution on extraction → execution logs visible in trigger detail and email detail.
