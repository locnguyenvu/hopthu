# Hopthu Email Client - Project Context

## Project Overview

Hopthu is a single-user email client designed to run on a remote server, unifying emails from multiple IMAP accounts into a single view with template-based data extraction. The application provides a clean, modern interface for managing multiple email accounts and extracting structured data from emails using customizable templates.

## Architecture

- **Backend**: Python (Quart + aiohttp + SQLAlchemy + Alembic)
- **Frontend**: Preact + Vite + Tailwind CSS
- **Database**: SQLite3 (aiosqlite)
- **Parser**: `docthu` library for email template extraction

## Key Features

### Core Email Client
- Account management for multiple IMAP accounts
- Mailbox management with sync toggling
- Email synchronization with deduplication
- Email list with filtering and pagination
- Email detail view with HTML sandboxing

### Template & Data Extraction
- Template management for parsing email content
- Auto-extraction of structured data using templates
- Template editor with field management
- Priority-based template matching

### Connections & Triggers
- External API connections with secure credential storage
- Event-driven automation system
- Field mapping between extracted data and API payloads
- Trigger execution logging and monitoring
- Real-time trigger firing when emails are parsed

## Project Structure

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
│   │   │   ├── connections.py   # Connection management
│   │   │   ├── mailboxes.py     # Mailbox management
│   │   │   ├── emails.py        # Email endpoints + sync
│   │   │   ├── templates.py     # Template CRUD + test
│   │   │   └── triggers.py      # Trigger management
│   │   ├── services/
│   │   │   ├── imap.py          # IMAP connection
│   │   │   ├── sync.py          # Email sync logic
│   │   │   ├── parser.py        # Template matching
│   │   │   └── trigger.py       # Trigger execution
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

## Environment Variables

- `QUART_SECRET_KEY` - Secret key for sessions
- `QUART_DB_PATH` - Path to SQLite database
- `QUART_USER_PASSWORD_HASH` - Password hash for authentication
- `QUART_TZ` - App timezone (default: Asia/Ho_Chi_Minh)

## Building and Running

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

Alternatively, you can use process-compose to run both services simultaneously:

```bash
# Start all services in daemon mode
process-compose up -D

# Restart a specific process (quart or vite)
process-compose process restart quart
process-compose process restart vite

# Stop all services
process-compose down
```

The process-compose configuration is defined in `process-compose.yml` and includes:
- `quart`: Runs the backend server with environment variables loaded from `.env`
- `vite`: Runs the frontend development server from the `frontend` directory with environment variables loaded from `.env`
- `heart-beat`: A utility process that keeps the process-compose session alive

### Production Build
```bash
cd frontend
npm run build

# Run with hypercorn
QUART_DB_PATH=./data.db QUART_SECRET_KEY=<secret> QUART_USER_PASSWORD_HASH=<hash> uv run hypercorn run:app --bind 0.0.0.0:5000
```

## Development Conventions

- All credentials are encrypted at rest using Fernet
- IMAP connections use SSL by default
- Email sync runs as background tasks
- HTML emails are rendered in sandboxed iframes
- Template matching uses priority: explicit → exact subject → catch-all
- Connections store API endpoints and headers with encrypted values
- Triggers execute automatically when emails are parsed and match templates
- Trigger execution is logged with detailed status and response information
- Field mapping supports complex data transformations between email data and API payloads

## Important Notes

- The application uses a single-user authentication model with password hashing
- All sensitive data like email credentials are encrypted at rest
- The frontend is a single-page application built with Preact
- The backend follows a RESTful API design with consistent response formats
- The project uses Alembic for database migrations
- Email parsing uses the custom `docthu` library with fallback mechanisms

## Docthu Library

The application leverages the `docthu` library for email template extraction and parsing. This custom library is used to extract structured data from emails based on predefined templates.

For detailed information about the `docthu` library and its capabilities, refer to the documentation at: https://raw.githubusercontent.com/locnguyenvu/docthu/refs/heads/main/llms.txt

The library is integrated into the email parsing workflow and provides the core functionality for transforming unstructured email content into structured data based on user-defined templates.