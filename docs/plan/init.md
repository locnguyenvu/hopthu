# Email Client — Implementation Plan

## Project Summary

A single-user email client running on a remote server (Tailscale private network), unifying emails from multiple IMAP accounts into a single view. Users define parser templates to extract structured data (JSON) from email content for downstream use (future webhook-based workflow engine).

**Tech stack:** Python (Quart + aiohttp + SQLAlchemy), Preact + Vite + Tailwind CSS, SQLite3, `docthu` parser library. Project managed with `uv`.

**Parser library:** [`docthu`](https://github.com/locnguyenvu/docthu) — install via:
```bash
uv add git+https://github.com/locnguyenvu/docthu.git
```

---

## Phase 1: Core Email Client

### 1.1 Project Setup

**Backend**

1. The project is already initialized via `uv init --name='hopthu' --app`. Add dependencies:
   ```bash
   uv add quart aiohttp sqlalchemy aiosqlite aioimaplib cryptography werkzeug
   uv add git+https://github.com/locnguyenvu/docthu.git
   ```
2. Project structure:
   ```
   hopthu/
   ├── pyproject.toml          # uv project config
   ├── app/
   │   ├── __init__.py
   │   ├── config.py
   │   ├── db.py               # SQLAlchemy engine + session setup
   │   ├── models.py           # SQLAlchemy ORM models
   │   ├── routes/
   │   │   ├── __init__.py
   │   │   ├── auth.py
   │   │   ├── accounts.py
   │   │   ├── mailboxes.py
   │   │   ├── emails.py
   │   │   └── templates.py
   │   ├── services/
   │   │   ├── __init__.py
   │   │   ├── imap.py
   │   │   ├── sync.py
   │   │   └── parser.py
   │   └── static/             # Vite build output goes here
   │       └── index.html
   ├── frontend/
   │   ├── package.json
   │   ├── vite.config.js
   │   ├── tailwind.config.js
   │   ├── postcss.config.js
   │   └── src/
   │       ├── index.jsx
   │       ├── app.jsx
   │       ├── api.js
   │       ├── styles/
   │       │   └── main.css    # Tailwind directives
   │       ├── components/
   │       └── pages/
   └── run.py
   ```
3. Configure Vite to build into `app/static/`. Quart serves the bundled JS/CSS from this directory in production.
4. Set up a `config.py` that reads from environment variables or a `.env` file: `QUART_SECRET_KEY`, `QUART_DB_PATH`, `QUART_USER_PASSWORD_HASH`, `QUART_TZ` (e.g., `Asia/Ho_Chi_Minh`).
5. Set up Fernet encryption for account credentials in `config.py`:
   ```python
   import base64
   import hashlib
   from cryptography.fernet import Fernet

   # Derive a Fernet-compatible key from QUART_SECRET_KEY
   def get_fernet() -> Fernet:
       key = hashlib.sha256(QUART_SECRET_KEY.encode()).digest()
       return Fernet(base64.urlsafe_b64encode(key))

   def encrypt_credential(plain_text: str) -> str:
       return get_fernet().encrypt(plain_text.encode()).decode()

   def decrypt_credential(encrypted: str) -> str:
       return get_fernet().decrypt(encrypted.encode()).decode()
   ```
   All account passwords are stored encrypted via `encrypt_credential()` and decrypted via `decrypt_credential()` only when connecting to IMAP.

**Frontend**

1. Initialize a Preact + Vite project under `frontend/`:
   ```bash
   cd frontend
   npm create vite@latest . -- --template preact
   npm install preact-router
   npm install -D tailwindcss @tailwindcss/vite
   ```
2. Configure Tailwind CSS:
   - Add Tailwind vite plugin to `vite.config.js`.
   - In `src/styles/main.css`, add `@import "tailwindcss";`.
3. Configure Vite's build output to `../app/static/`.

**Database**

1. In `db.py`, configure SQLAlchemy async engine with `aiosqlite` backend, enabling foreign keys and WAL mode:
   ```python
   from sqlalchemy import event, text
   from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

   engine = create_async_engine(f"sqlite+aiosqlite:///{config.QUART_DB_PATH}")

   @event.listens_for(engine.sync_engine, "connect")
   def set_sqlite_pragma(dbapi_connection, connection_record):
       cursor = dbapi_connection.cursor()
       cursor.execute("PRAGMA foreign_keys=ON")
       cursor.execute("PRAGMA journal_mode=WAL")
       cursor.close()
   ```
2. In `models.py`, define all ORM models using SQLAlchemy declarative base (see Section 1.2).
3. On app startup, call `async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)` to create tables.

---

### 1.2 Database Models (SQLAlchemy ORM)

```python
# app/models.py
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON,
    UniqueConstraint, Index
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, unique=True)
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=False, default=993)
    is_ssl = Column(Boolean, nullable=False, default=True)
    authenticated_method = Column(String, nullable=False, default="password")
    credential = Column(String, nullable=False)        # encrypted password
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    mailboxes = relationship("Mailbox", back_populates="account", cascade="all, delete-orphan")
    emails = relationship("Email", back_populates="account", cascade="all, delete-orphan")


class Mailbox(Base):
    __tablename__ = "mailboxes"
    __table_args__ = (UniqueConstraint("account_id", "name"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    account = relationship("Account", back_populates="mailboxes")
    emails = relationship("Email", back_populates="mailbox", cascade="all, delete-orphan")


class Email(Base):
    __tablename__ = "emails"
    __table_args__ = (
        UniqueConstraint("account_id", "message_id"),  # deduplicate by Message-ID
        Index("idx_emails_status", "status"),
        Index("idx_emails_from", "from_email"),
        Index("idx_emails_received", "received_at"),
        Index("idx_emails_account_mailbox", "account_id", "mailbox_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    mailbox_id = Column(Integer, ForeignKey("mailboxes.id", ondelete="CASCADE"), nullable=False)
    from_email = Column(String, nullable=False)
    to_email = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    content_type = Column(String, nullable=False)       # 'text/plain' or 'text/html'
    body = Column(Text, nullable=True)
    message_id = Column(String, nullable=False)          # extracted from Message-ID header
    meta_data = Column(JSON, nullable=False, default=dict)  # additional headers
    status = Column(String, nullable=False, default="new")  # new | extracted | ignored
    received_at = Column(DateTime, nullable=False)       # from IMAP server, stored in app timezone
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    account = relationship("Account", back_populates="emails")
    mailbox = relationship("Mailbox", back_populates="emails")
    email_data = relationship("EmailData", back_populates="email", uselist=False, cascade="all, delete-orphan")


class Template(Base):
    __tablename__ = "templates"
    __table_args__ = (
        Index("idx_templates_from", "from_email"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_email = Column(String, nullable=False)
    subject = Column(String, nullable=True)              # NULL = match any subject from this sender
    content_type = Column(String, nullable=False)
    template = Column(Text, nullable=False)              # template body with variable markers
    fields = Column(JSON, nullable=False, default=list)  # list of variable names
    priority = Column(Integer, nullable=True)            # NULL = auto-order
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailData(Base):
    __tablename__ = "email_data"
    __table_args__ = (UniqueConstraint("email_id"),)     # one extraction per email

    id = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(Integer, ForeignKey("emails.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="CASCADE"), nullable=False)
    data = Column(JSON, nullable=False, default=dict)    # { meta_data: {...}, extracted_data: {...} }
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    email = relationship("Email", back_populates="email_data")
    template = relationship("Template")
```

**Notes on the models:**
- `message_id` is promoted to a dedicated column (extracted from the `Message-ID` header) for clean deduplication via `UniqueConstraint("account_id", "message_id")`. The `meta_data` JSON column stores any additional headers.
- All datetimes are stored in the app timezone (`QUART_TZ`). When parsing email headers, convert the date to the app timezone before saving. The API returns datetimes as-is (already in the correct timezone).
- `templates.priority` is nullable. When NULL, the system uses the default ordering: exact subject match first, then `created_at ASC`.
- `email_data` has a `UNIQUE(email_id)` constraint — re-parsing overwrites the existing row via upsert.

---

### 1.3 Authentication

**How it works:**
- Single user. Password hash is stored in config (environment variable), not in the database.
- Quart serves a login page at `/login` (server-rendered or a minimal standalone HTML).
- On POST `/api/auth/login`, verify password against the stored hash. On success, set a session cookie via Quart's built-in session handling (`quart.sessions`).
- All other `/api/*` routes are protected by a decorator that checks for a valid session.
- The SPA routes (`/`, `/emails/*`, `/accounts/*`, `/templates/*`) are served by a catch-all Quart route that returns `index.html` from the static folder. The session check should also protect this route.

**Endpoints:**

| Method | Path             | Description          |
|--------|------------------|----------------------|
| GET    | `/login`         | Serve login page     |
| POST   | `/api/auth/login`| Authenticate user    |
| POST   | `/api/auth/logout`| Clear session       |

**Instructions:**
1. Use `werkzeug.security.generate_password_hash` / `check_password_hash` for password hashing.
2. Store the hash in an environment variable `QUART_USER_PASSWORD_HASH`. Generate it once with:
   ```bash
   uv run python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your-password'))"
   ```
3. Session secret key from `QUART_SECRET_KEY` env var.

---

### 1.4 Account Management

**Endpoints:**

| Method | Path                          | Description                        |
|--------|-------------------------------|------------------------------------|
| GET    | `/api/accounts`               | List all accounts                  |
| POST   | `/api/accounts`               | Create a new account               |
| PUT    | `/api/accounts/<id>`          | Update an account                  |
| DELETE | `/api/accounts/<id>`          | Delete account and related data    |
| POST   | `/api/accounts/<id>/test`     | Test IMAP connection               |

**Create account flow:**

1. User fills in: email, host, port, SSL flag, password.
2. Frontend calls `POST /api/accounts` with the payload.
3. Backend encrypts the password using `config.encrypt_credential(password)`, saves to database.
4. Backend immediately attempts an IMAP login with the provided credentials.
5. If login succeeds → return `201` with the account object.
6. If login fails → return `400` with the error message. Do not save the account.

**Test connection flow:**
- `POST /api/accounts/<id>/test` — decrypt credential via `config.decrypt_credential()`, attempt IMAP login, return success/failure.

**Instructions:**
1. The IMAP service (`services/imap.py`) should have an `async def test_connection(host, port, is_ssl, email, password) -> bool` function.
2. On account creation, call `test_connection` before inserting into the database. Only save if it succeeds.
3. Credential encryption: use `config.encrypt_credential()` on save, `config.decrypt_credential()` when connecting to IMAP. Never store or return the plain-text password.
4. All database operations use SQLAlchemy async sessions via `async_sessionmaker`.

---

### 1.5 Mailbox Management

**Endpoints:**

| Method | Path                              | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/api/accounts/<id>/mailboxes`    | List mailboxes for an account        |
| POST   | `/api/accounts/<id>/mailboxes/fetch` | Fetch mailbox list from IMAP      |
| PUT    | `/api/mailboxes/<id>`             | Toggle `is_active` flag              |

**Fetch mailboxes flow:**

1. User clicks "Fetch Mailboxes" on an account.
2. Backend connects to IMAP, runs `LIST` command, gets all folder names.
3. Upsert mailboxes into the `mailboxes` table (insert new ones, keep existing ones with their `is_active` state).
4. Return the full list. User toggles which ones are active.

**Instructions:**
1. In `services/imap.py`, add `async def fetch_mailboxes(host, port, is_ssl, email, password) -> list[str]`.
2. The upsert logic: for each mailbox name from IMAP, `INSERT OR IGNORE` into the table. Then return all mailboxes for this account.

---

### 1.6 Email Sync

**Endpoints:**

| Method | Path                              | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/api/emails`                     | List emails (paginated, filtered)    |
| GET    | `/api/emails/<id>`                | Get single email detail              |
| PUT    | `/api/emails/<id>/status`         | Update email status (for `ignored`)  |
| POST   | `/api/sync`                       | Trigger a manual sync for all accounts |
| POST   | `/api/accounts/<id>/sync`         | Trigger sync for a specific account  |

**Sync flow:**

1. For each account, for each active mailbox:
   - Connect to IMAP.
   - Search for messages from today (use IMAP `SEARCH SINCE <date>` command). Limit to 20 messages.
   - For each message, fetch headers first: extract `Message-ID`.
   - Check if `Message-ID` already exists in `emails` table. Skip if duplicate.
   - Fetch the full message. Parse the first content part (either `text/plain` or `text/html` — whichever comes first in the MIME structure).
   - Extract: `from_email`, `to_email`, `subject`, `content_type`, `body`, `received_at` (from the `Date` header), and `meta_data` (at minimum `{"Message-ID": "..."}`) .
   - Insert into `emails` table with `status = 'new'`.
2. All datetimes from the IMAP server should be converted to the app timezone (`QUART_TZ`) before storage.

**List emails endpoint — query parameters:**

| Param       | Type   | Description                                      |
|-------------|--------|--------------------------------------------------|
| `page`      | int    | Page number, default 1                           |
| `per_page`  | int    | Items per page, default 20                       |
| `from_email`| string | Filter by sender                                 |
| `date_from` | string | Filter by `received_at >= date_from` (ISO format)|
| `date_to`   | string | Filter by `received_at <= date_to` (ISO format)  |
| `status`    | string | Filter by status                                 |
| `account_id`| int    | Filter by account                                |
| `mailbox_id`| int    | Filter by mailbox                                |

Default sort: `received_at DESC`.

**Instructions:**
1. Build `services/sync.py` with `async def sync_account(account_id: int)` and `async def sync_all()`.
2. Use `aioimaplib` for async IMAP operations.
3. Parse emails with Python's built-in `email` module (`email.message_from_bytes`).
4. For the "first content type" logic: walk the MIME tree, return the first `text/plain` or `text/html` part encountered.
5. The sync endpoint should run the sync as an async background task (`quart.current_app.add_background_task`) and return immediately with a `202 Accepted`.
6. **Timezone handling:** When parsing the `Date` header from an email, convert it to the app timezone (`QUART_TZ`) before saving to `received_at`. Use `zoneinfo.ZoneInfo` for conversion:
   ```python
   from zoneinfo import ZoneInfo
   from email.utils import parsedate_to_datetime

   app_tz = ZoneInfo(config.QUART_TZ)
   received_at = parsedate_to_datetime(date_header).astimezone(app_tz)
   ```
   All datetimes are stored and returned in the app timezone. No additional conversion needed on the API layer.

---

### 1.7 Frontend — Phase 1

**Routes:**

| Route                | View             | Description                         |
|----------------------|------------------|-------------------------------------|
| `/`                  | Inbox            | Unified email list, filters, sort   |
| `/accounts`          | Account List     | Manage IMAP accounts                |
| `/accounts/new`      | Account Form     | Add new account                     |
| `/accounts/:id`      | Account Detail   | Edit account, manage mailboxes      |
| `/emails/:id`        | Email Detail     | View email, manage status           |

**Inbox view (Fastmail-inspired, minimal):**
1. Left sidebar: list of accounts, each expandable to show active mailboxes. An "All" option at top.
2. Main area: email list as rows — each row shows `from_email`, `subject` (truncated), `received_at` (already in app timezone from API), and a status badge.
3. Top bar: date range filter (from/to date pickers), a text input to filter by `from_email`, and a sync button.
4. Clicking an email row navigates to `/emails/:id`.
5. Pagination at the bottom.

**Email detail view:**
1. Show full email headers: from, to, subject, received date.
2. Render the email body in an `<iframe>` for HTML content, or in a `<pre>` block for plain text.
3. Status controls: a dropdown or buttons to set status (`new`, `ignored`). `extracted` is set by the system only.
4. A "Create Template" button that navigates to the template editor pre-populated from this email (Phase 2).
5. A section showing matched templates and their parse results (Phase 2).

**Account management views:**
1. Account list: table showing email, host, connection status indicator.
2. Account form: inputs for email, host, port, SSL toggle, password. A "Test Connection" button. On success, save.
3. Account detail: edit fields, plus a "Fetch Mailboxes" button. Below it, a list of mailboxes with toggle switches for `is_active`.

**Instructions:**
1. Use `preact-router` for client-side routing.
2. Create a simple API client module (`frontend/src/api.js`) that wraps `fetch` calls to `/api/*`. Handle 401 by redirecting to `/login`.
3. Use Tailwind CSS for all styling. Keep the UI minimal and clean — Tailwind utility classes only, no additional component library needed.
4. The iframe for email rendering: set `srcdoc` attribute with the HTML body. Apply `sandbox` attribute to the iframe to prevent scripts from running inside it (even though this is a private network, it's good practice).

---

## Phase 2: Template & Data Extraction

### 2.1 Template Management

**Endpoints:**

| Method | Path                              | Description                            |
|--------|-----------------------------------|----------------------------------------|
| GET    | `/api/templates`                  | List all templates                     |
| POST   | `/api/templates`                  | Create a new template                  |
| GET    | `/api/templates/<id>`             | Get template detail                    |
| PUT    | `/api/templates/<id>`             | Update a template                      |
| DELETE | `/api/templates/<id>`             | Delete a template                      |
| POST   | `/api/templates/<id>/test`        | Test template against a given email    |
| GET    | `/api/emails/<id>/templates`      | List templates matching this email     |

**Template creation flow (from email detail):**

1. User views an email, clicks "Create Template."
2. System creates a new template pre-populated with:
   - `from_email` = email's `from_email`
   - `subject` = email's `subject`
   - `content_type` = email's `content_type`
   - `template` = email's full `body`
   - `fields` = `[]`
   - `priority` = `NULL`
3. User is taken to the template editor.

**Template editor UI:**

1. The view is split into two areas:
   - **Left/top panel:** The email body rendered in an `<iframe>` (HTML) or `<pre>` (plain text). This is the visual reference. The user interacts with this to select text and mark variables.
   - **Right/bottom panel:** A `<textarea>` showing the raw template body. This updates as the user marks variables. User can also edit directly here.
2. Variable marking flow (following the `docthu` email selector pattern):
   - User selects text in the rendered email.
   - A prompt asks for the variable name.
   - The selected text in the raw template is replaced with a placeholder (e.g., `{{variable_name}}`).
   - The variable name is added to the `fields` JSON array.
3. A fields list is shown beside the textarea, displaying all defined variables. User can remove a variable (which reverts the placeholder in the template back to original text).
4. An optional `priority` number input.
5. A "Test" button: user picks an email to test this template against. The system runs the parser and shows the extracted JSON.
6. A "Save" button.

**Instructions:**
1. Copy the relevant code from `docthu`'s `email_selector/index.html` into the Preact component. Adapt it to work as a Preact component rather than standalone HTML.
2. For the iframe text selection: use `window.postMessage` from within the iframe to communicate selected text ranges back to the parent Preact component.
3. The `<textarea>` is the source of truth. Visual selection is a convenience for finding the right text to replace.
4. The test endpoint `POST /api/templates/<id>/test` accepts `{ email_id: int }` and returns the parsed result or an error.

---

### 2.2 Parsing Engine

**How template matching works when an email is fetched:**

1. Query all templates where `from_email` = email's `from_email`.
2. Sort them:
   - Templates with `priority IS NOT NULL` — sorted by `priority ASC`.
   - Templates with `priority IS NULL` and `subject` exactly matches email's `subject` — sorted by `created_at ASC`.
   - Templates with `priority IS NULL` and `subject IS NULL` (catch-all for this sender) — sorted by `created_at ASC`.
   - Within these groups, the order is: explicit priority first, then exact subject match, then catch-all.
3. For each template in order:
   - Run the `docthu` parser with the template against the email body.
   - If parsing succeeds (all fields extracted) → save result, stop.
   - If parsing fails → try the next template.
4. If all templates fail or no templates match → email stays with `status = 'new'`.
5. If parsing succeeds:
   - Upsert into `email_data`: `{ meta_data: { received_at: email.received_at }, extracted_data: { ...parsed fields } }`.
   - Update `emails.status` to `'extracted'`.

**Instructions:**
1. Build `services/parser.py` with:
   - `async def find_matching_templates(from_email: str) -> list[Template]` — returns templates in priority order as described above.
   - `def parse_email(template: Template, email_body: str, content_type: str) -> dict | None` — runs the docthu parser, returns extracted data or None on failure.
   - `async def process_email(email_id: int)` — the main orchestrator: fetch email, find templates, try each, save result.
2. Integrate `process_email` into the sync flow: after each email is inserted, call `process_email` on it.
3. For re-parsing: add an endpoint `POST /api/emails/<id>/reparse` that re-runs `process_email` on an existing email (useful after template changes).

---

### 2.3 Frontend — Phase 2

**New routes:**

| Route                     | View             | Description                          |
|---------------------------|------------------|--------------------------------------|
| `/templates`              | Template List    | All templates                        |
| `/templates/new`          | Template Editor  | Create template (standalone)         |
| `/templates/:id`          | Template Editor  | Edit existing template               |
| `/emails/:id/new-template`| Template Editor  | Create template from email           |

**Updates to existing views:**

1. **Email detail view** — add:
   - "Create Template" button → navigates to `/emails/:id/new-template`.
   - "Matched Templates" section: calls `GET /api/emails/<id>/templates`, lists matching templates with a "Run" button next to each.
   - If `email_data` exists, show the extracted JSON in a collapsible section.
   - "Re-parse" button that calls `POST /api/emails/<id>/reparse`.

2. **Inbox view** — add:
   - Status badge colors: `new` = neutral/gray, `extracted` = green, `ignored` = muted.
   - Quick filter by status.

3. **Sidebar** — add:
   - A "Templates" link in the navigation.

**Template list view:**
1. Table: `from_email`, `subject` (or "Any"), `fields` count, `priority`, `created_at`.
2. Click to edit. Delete button with confirmation.

---

## API Response Conventions

All API responses follow this shape:

```json
// Success
{ "data": { ... }, "error": null }

// Success (list)
{ "data": [ ... ], "pagination": { "page": 1, "per_page": 20, "total": 150 }, "error": null }

// Error
{ "data": null, "error": { "message": "Something went wrong" } }
```

All datetime fields in responses are formatted in the app timezone (`QUART_TZ`) as ISO 8601 strings.

---

## Development Workflow

### Environment

1. **Local development:** Run Vite dev server (`cd frontend && npm run dev`) with proxy to Quart backend. Run Quart with `uv run python run.py` (debug mode).
2. **Production build:** `cd frontend && npm run build` outputs to `app/static/`. Quart serves the SPA from there. The catch-all route returns `index.html` for all non-API, non-login paths.
3. **Database:** SQLAlchemy handles table creation on app startup via `Base.metadata.create_all`. For future schema changes, use Alembic if needed.
4. **Running the app:**
   ```bash
   # Development
   QUART_TZ=Asia/Ho_Chi_Minh QUART_SECRET_KEY=dev-secret QUART_DB_PATH=./data.db QUART_USER_PASSWORD_HASH=... uv run python run.py

   # Production
   QUART_TZ=Asia/Ho_Chi_Minh QUART_SECRET_KEY=... QUART_DB_PATH=./data.db QUART_USER_PASSWORD_HASH=... uv run hypercorn run:app --bind 0.0.0.0:5000
   ```
5. **Deployment:** Run behind `hypercorn` for production ASGI. Accessible on Tailscale network only.

---

### Red-Green Development Process

Follow red-green (test-first) development throughout. For every step: write a failing test first (red), implement the minimum code to make it pass (green), then refactor if needed. Do not move to the next step until the current step's tests all pass and the feature works end-to-end.

**Testing stack:**
- Backend: `pytest` + `pytest-asyncio` for async tests. Use an in-memory SQLite database for test isolation.
- Frontend: lightweight testing as needed (manual verification is acceptable for UI during Phase 1).
- Install test dependencies:
  ```bash
  uv add --dev pytest pytest-asyncio httpx
  ```
- Run tests: `uv run pytest` — all tests must pass before proceeding to the next step.

---

### Step-by-Step Build Order

Each step below is a self-contained unit. Complete it fully (tests pass, feature works) before starting the next.

#### Phase 1

**Step 1: Project skeleton + database**
- RED: Write a test that imports the app, starts it, and confirms the database tables are created (all 5 tables exist).
- GREEN: Project is already inited (`uv init --name='hopthu' --app`). Add dependencies, set up `app/__init__.py` (Quart app factory), `config.py`, `db.py` (engine with FK + WAL pragmas), `models.py` (all ORM models). App starts and creates tables.
- VERIFY: `uv run pytest` passes. App starts with `uv run python run.py` without errors.

**Step 2: Authentication**
- RED: Write tests for `POST /api/auth/login` — test correct password returns 200 + session cookie, wrong password returns 401. Test that a protected route returns 401 without session and 200 with session.
- GREEN: Implement `routes/auth.py` with login/logout endpoints. Implement the `@login_required` decorator. Serve a minimal login HTML page at `GET /login`.
- VERIFY: All auth tests pass. Manually test login in browser → session cookie is set → protected routes work.

**Step 3: Account management (backend)**
- RED: Write tests for CRUD endpoints — create account (with encrypted credential stored), list accounts (credential not exposed in response), update account, delete account (cascade).
- GREEN: Implement `routes/accounts.py`. Use `config.encrypt_credential()` on create/update. Implement `services/imap.py` with `test_connection()` — for now, mock IMAP in tests.
- VERIFY: All account tests pass. Credentials in the database are encrypted (not plain text).

**Step 4: Account management (frontend)**
- Set up the Preact + Vite + Tailwind project under `frontend/`.
- Build the SPA shell: router, API client module (`api.js` with 401 redirect), layout with sidebar.
- Build account list, account form (create/edit), and test connection button.
- VERIFY: Can create an account in the browser, see it in the list, edit it, delete it. Test connection button shows success/failure.

**Step 5: Mailbox management (backend)**
- RED: Write tests for `POST /api/accounts/<id>/mailboxes/fetch` (mock IMAP LIST), `GET /api/accounts/<id>/mailboxes`, `PUT /api/mailboxes/<id>` (toggle active).
- GREEN: Implement `routes/mailboxes.py`. Add `fetch_mailboxes()` to `services/imap.py`. Implement upsert logic.
- VERIFY: All mailbox tests pass.

**Step 6: Mailbox management (frontend)**
- Add "Fetch Mailboxes" button and mailbox toggle list to the account detail view.
- VERIFY: Can fetch mailboxes from a real IMAP account, toggle active state, see the state persist on refresh.

**Step 7: Email sync (backend)**
- RED: Write tests for `sync_account()` — mock IMAP, verify emails are inserted with correct fields, duplicates are skipped (Message-ID check), datetimes are converted to `QUART_TZ`.
- GREEN: Implement `services/sync.py` with `sync_account()` and `sync_all()`. Parse emails with Python's `email` module. Implement `POST /api/sync` and `POST /api/accounts/<id>/sync` (background task, returns 202).
- VERIFY: All sync tests pass. Timezone conversion is correct.

**Step 8: Email list + detail (backend)**
- RED: Write tests for `GET /api/emails` — test pagination, each filter (`from_email`, `date_from`, `date_to`, `status`, `account_id`, `mailbox_id`), and sort order. Write test for `GET /api/emails/<id>`. Write test for `PUT /api/emails/<id>/status`.
- GREEN: Implement `routes/emails.py` with query building.
- VERIFY: All email endpoint tests pass.

**Step 9: Email list + detail (frontend)**
- Build the inbox view: email list with rows, pagination, filters (date range, from_email), sync button.
- Build the email detail view: headers, body rendering (iframe for HTML, pre for plain text), status controls.
- VERIFY: Can trigger sync, see emails appear in the list, filter and paginate, click into detail view, change status to ignored. Full Phase 1 flow works end-to-end.

**Step 9 is the Phase 1 milestone.** Stop here and verify the entire flow works: login → create account → test connection → fetch mailboxes → activate mailboxes → sync emails → browse and filter emails → view email detail → mark as ignored.

---

#### Phase 2

**Step 10: Template CRUD (backend)**
- RED: Write tests for all template endpoints — create, read, update, delete, list. Test that `GET /api/emails/<id>/templates` returns templates matching the email's `from_email`.
- GREEN: Implement `routes/templates.py`.
- VERIFY: All template CRUD tests pass.

**Step 11: Parsing engine (backend)**
- RED: Write tests for `find_matching_templates()` — test priority ordering: explicit priority first, then exact subject match, then catch-all, then `created_at ASC` within groups. Write tests for `parse_email()` with the `docthu` parser — test success returns dict, failure returns None. Write tests for `process_email()` — test first successful template stops iteration, test all-fail keeps status as `new`, test success sets status to `extracted` and saves `email_data`.
- GREEN: Implement `services/parser.py` with all three functions. Wire `process_email()` into `services/sync.py` so it runs after each email is inserted.
- VERIFY: All parser tests pass. The priority ordering is correct.

**Step 12: Template test endpoint (backend)**
- RED: Write test for `POST /api/templates/<id>/test` with `{ email_id }` — test returns parsed JSON on success, error on failure.
- GREEN: Implement the endpoint using `parse_email()`.
- RED: Write test for `POST /api/emails/<id>/reparse` — test it re-runs parsing and overwrites existing `email_data`.
- GREEN: Implement the endpoint.
- VERIFY: All tests pass.

**Step 13: Template editor (frontend)**
- Build the template editor view: split layout with iframe (HTML) or pre (plain text) on one side, textarea on the other.
- Implement variable marking: text selection in iframe → prompt for variable name → replace in textarea → update fields list.
- Add fields list display with remove capability.
- Add priority input.
- VERIFY: Can create a template from an email, mark variables, see them in the fields list, remove a variable, edit the textarea directly.

**Step 14: Template testing + integration (frontend)**
- Add "Test" button to template editor: pick an email, run the parser, display extracted JSON.
- Add template list view with table and delete.
- Update email detail view: "Create Template" button, "Matched Templates" section with "Run" button, extracted data display, "Re-parse" button.
- Update inbox view: status badge colors, quick filter by status.
- Add "Templates" link to sidebar.
- VERIFY: Full Phase 2 flow works end-to-end: create template from email → mark variables → test against another email → save → sync new email → auto-extraction runs → extracted data visible in email detail.

**Step 14 is the Phase 2 milestone.** Verify the complete flow: everything from Phase 1 still works, plus template creation → variable marking → testing → auto-extraction on sync → re-parsing after template changes.

