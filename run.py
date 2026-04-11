"""Entry point to run the Quart application."""

from hopthu.app import create_app

app = create_app()

if __name__ == "__main__":
    import os

    # Check for required environment variables
    if not os.environ.get("QUART_SECRET_KEY"):
        print("Warning: QUART_SECRET_KEY not set. This is required for secure sessions.")

    if not os.environ.get("QUART_USER_PASSWORD_HASH"):
        print("Warning: QUART_USER_PASSWORD_HASH not set. Authentication will fail.")
        print("Generate a password hash with:")
        print("  uv run python -c \"from werkzeug.security import generate_password_hash; print(generate_password_hash('your-password'))\"")

    # Run the app
    app.run(debug=True, host="0.0.0.0", port=5174)
