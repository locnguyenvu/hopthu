"""Quart application factory."""

from pathlib import Path

from quart import Quart, send_from_directory

from hopthu.app import config
from hopthu.app.routes.auth import login_required


def create_app():
    """Create and configure the Quart application."""
    # Get the static folder path (frontend build output)
    static_folder = Path(__file__).parent / "static"
    static_folder.mkdir(parents=True, exist_ok=True)

    app = Quart(__name__, static_folder=static_folder, static_url_path="/static")

    # Configure secret key for sessions
    app.config.from_prefixed_env()
    # app.config["SECRET_KEY"] = config.QUART_SECRET_KEY

    # Import and register blueprints
    from hopthu.app.routes.auth import bp as auth_bp
    from hopthu.app.routes.accounts import bp as accounts_bp
    from hopthu.app.routes.mailboxes import bp as mailboxes_bp
    from hopthu.app.routes.emails import bp as emails_bp
    from hopthu.app.routes.templates import bp as templates_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(accounts_bp)
    app.register_blueprint(mailboxes_bp)
    app.register_blueprint(emails_bp)
    app.register_blueprint(templates_bp)

    # Serve index.html for all non-API, non-login routes (SPA catch-all)
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    @login_required
    async def catch_all(path):
        """Serve the SPA for all routes."""
        index_file = static_folder / "index.html"
        if index_file.exists():
            return await send_from_directory(static_folder, "index.html")
        # Return a placeholder if frontend hasn't been built yet
        return "Frontend not built yet. Run 'cd frontend && npm run build'.", 200

    return app
