"""Authentication routes and utilities."""

from functools import wraps

from quart import Blueprint, request, session, redirect, render_template_string
from werkzeug.security import check_password_hash

from hopthu.app import config
from quart import current_app

bp = Blueprint("auth", __name__)


# Minimal login HTML template
LOGIN_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hopthu - Login</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .login-box {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }
        h1 { margin-bottom: 24px; color: #333; font-size: 24px; text-align: center; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; color: #555; font-weight: 500; }
        input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
        }
        input[type="password"]:focus {
            outline: none;
            border-color: #4a90d9;
        }
        button {
            width: 100%;
            padding: 12px;
            background: #4a90d9;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
        }
        button:hover { background: #357abd; }
        .error {
            color: #e74c3c;
            margin-top: 16px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="login-box">
        <h1>Hopthu</h1>
        <form method="POST" action="/api/auth/login">
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>
            <button type="submit">Sign In</button>
        </form>
        {% if error %}
        <div class="error">{{ error }}</div>
        {% endif %}
    </div>
</body>
</html>
"""


def login_required(f):
    """Decorator to protect routes that require authentication."""
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        if "user" not in session:
            return redirect("/login")
        return await f(*args, **kwargs)
    return decorated_function


def api_login_required(f):
    """Decorator to protect API routes that require authentication."""
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        if "user" not in session:
            return {"data": None, "error": {"message": "Unauthorized"}}, 401
        return await f(*args, **kwargs)
    return decorated_function


@bp.route("/login", methods=["GET"])
async def login_page():
    """Serve the login page."""
    error = request.args.get("error")
    return await render_template_string(LOGIN_TEMPLATE, error=error)


@bp.route("/api/auth/login", methods=["POST"])
async def login():
    """Authenticate user and set session."""
    data = await request.form
    password = data.get("password", "")

    if not current_app.config['USER_PASSWORD_HASH']:
        return redirect("/login?error=Authentication not configured")

    if check_password_hash(current_app.config['USER_PASSWORD_HASH'], password):
        session["user"] = "admin"
        return redirect("/")
    else:
        return redirect("/login?error=Invalid password")


@bp.route("/api/auth/logout", methods=["POST"])
async def logout():
    """Clear the user session."""
    session.pop("user", None)
    return {"data": {"message": "Logged out"}, "error": None}
