# Hopthu Email Client - Implementation Summary

## Overview

A single-user email client running on a remote server (Tailscale private network), unifying emails from multiple IMAP accounts into a single view with template-based data extraction.

## Tech Stack

- **Backend**: Python (Quart + aiohttp + SQLAlchemy + Alembic)
- **Frontend**: Preact + Vite + Tailwind CSS
- **Database**: SQLite3 (aiosqlite)
- **Parser**: `docthu` library for email template extraction

## Completed Features

### Phase 1: Core Email Client

#### 1. Project Setup ✅
- Quart application factory pattern
- SQLAlchemy async models with proper relationships
- Alembic migrations with WAL mode and foreign keys
- Fernet credential encryption for account passwords
- Environment-based configuration

#### 2. Authentication ✅
- Single-user login with password hash
- Session-based authentication
- `@login_required` and `@api_login_required` decorators
- Minimal login page

#### 3. Account Management ✅
- Create, read, update, delete IMAP accounts
- Credential encryption at rest
- IMAP connection testing before save
- Account list with connection test button

#### 4. Mailbox Management ✅
- Fetch mailboxes from IMAP server
- Toggle active/inactive for syncing
- Upsert logic to preserve active state

#### 5. Email Sync ✅
- Background sync task support
- Sync all accounts or single account
- Deduplication by Message-ID
- Extract text/plain or text/html content
- Timezone-aware datetime handling

#### 6. Email List & Detail ✅
- Paginated email list with filters
- Filter by: from_email, status, account_id, date range
- Email detail view with iframe sandboxing for HTML
- Status controls (new, ignored)

### Phase 2: Template & Data Extraction

#### 7. Template Management ✅
- Create, read, update, delete templates
- Template matching by from_email
- Priority-based template ordering
- Create template from email

#### 8. Parsing Engine ✅
- `docthu` library integration (with regex fallback)
- Template matching: explicit priority → exact subject → catch-all
- Auto-extraction on email sync
- Re-parse existing emails

#### 9. Template Editor ✅
- Split layout: reference email / template editor
- Field management (add/remove)
- Template testing against real emails
- Priority configuration

### Frontend Features

#### Pages Implemented
- **Inbox**: Email list with filters, pagination, sync button
- **Account List**: Manage IMAP accounts
- **Account Form**: Add new account with connection test
- **Account Detail**: Edit account, manage mailboxes
- **Email Detail**: View email, status controls, extracted data
- **Template List**: All templates table
- **Template Editor**: Create/edit templates with field marking

## File Structure

```
/home/loc/mystuff/hopthu/
├── src/hopthu/
│   ├── app/
│   │   ├── __init__.py          # Quart app factory
│   │   ├── config.py            # Environment config + Fernet
│   │   ├── db.py                # SQLAlchemy engine + session
│   │   ├── models.py            # ORM models
│   │   ├── routes/
│   │   │   ├── auth.py          # Login/logout
│   │   │   ├── accounts.py      # Account CRUD
│   │   │   ├── mailboxes.py     # Mailbox management
│   │   │   ├── emails.py        # Email endpoints + sync
│   │   │   └── templates.py     # Template CRUD + test
│   │   ├── services/
│   │   │   ├── imap.py          # IMAP connection
│   │   │   ├── sync.py          # Email sync logic
│   │   │   └── parser.py        # Template matching
│   │   └── static/              # Built frontend
│   └── __init__.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   ├── pages/
│   │   │   ├── Inbox.jsx
│   │   │   ├── AccountList.jsx
│   │   │   ├── AccountForm.jsx
│   │   │   ├── AccountDetail.jsx
│   │   │   ├── EmailDetail.jsx
│   │   │   ├── TemplateList.jsx
│   │   │   └── TemplateEditor.jsx
│   │   ├── api.js               # API client
│   │   ├── app.jsx              # Router
│   │   └── main.jsx             # Entry point
│   ├── package.json
│   └── vite.config.js           # Build config
├── migrations/                  # Alembic migrations
├── tests/                       # Test files
├── run.py                       # Entry point
└── pyproject.toml               # Project config
```

## API Endpoints

### Authentication
- `GET /login` - Login page
- `POST /api/auth/login` - Authenticate
- `POST /api/auth/logout` - Logout

### Accounts
- `GET /api/accounts` - List accounts
- `POST /api/accounts` - Create account (with connection test)
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account
- `POST /api/accounts/:id/test` - Test connection
- `POST /api/accounts/:id/sync` - Trigger sync

### Mailboxes
- `GET /api/accounts/:id/mailboxes` - List mailboxes
- `POST /api/accounts/:id/mailboxes/fetch` - Fetch from IMAP
- `PUT /api/mailboxes/:id` - Toggle active

### Emails
- `GET /api/emails` - List emails (paginated, filtered)
- `GET /api/emails/:id` - Get email detail
- `PUT /api/emails/:id/status` - Update status
- `POST /api/sync` - Sync all accounts
- `GET /api/emails/:id/templates` - Get matching templates
- `POST /api/emails/:id/reparse` - Re-parse email

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/templates/:id` - Get template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/:id/test` - Test template

## Running the Application

### Setup
```bash
# Install dependencies
uv add quart aiohttp sqlalchemy aiosqlite aioimaplib cryptography werkzeug alembic
uv add git+https://github.com/locnguyenvu/docthu.git
uv add --dev pytest pytest-asyncio httpx

# Frontend dependencies
cd frontend
npm install
npm install preact-router
npm install -D tailwindcss @tailwindcss/vite
```

### Database Setup
```bash
QUART_DB_PATH=./data.db uv run alembic upgrade head
```

### Generate Password Hash
```bash
uv run python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your-password'))"
```

### Development
```bash
# Terminal 1: Backend
QUART_DB_PATH=./data.db QUART_SECRET_KEY=dev-secret QUART_USER_PASSWORD_HASH=<hash> uv run python run.py

# Terminal 2: Frontend dev server
cd frontend
npm run dev
```

### Production Build
```bash
cd frontend
npm run build

# Run with hypercorn
QUART_DB_PATH=./data.db QUART_SECRET_KEY=<secret> QUART_USER_PASSWORD_HASH=<hash> uv run hypercorn run:app --bind 0.0.0.0:5000
```

## Environment Variables

- `QUART_SECRET_KEY` - Secret key for sessions
- `QUART_DB_PATH` - Path to SQLite database
- `QUART_USER_PASSWORD_HASH` - Password hash for authentication
- `QUART_TZ` - App timezone (default: Asia/Ho_Chi_Minh)

## Notes

- All credentials are encrypted at rest using Fernet
- IMAP connections use SSL by default
- Email sync runs as background tasks
- HTML emails are rendered in sandboxed iframes
- Template matching uses priority: explicit → exact subject → catch-all
