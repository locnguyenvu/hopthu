"""IMAP service for connecting to email servers."""

import asyncio
import re

from aioimaplib import aioimaplib


async def test_connection(
    host: str, port: int, is_ssl: bool, email: str, password: str
) -> tuple[bool, str]:
    """
    Test IMAP connection with provided credentials.

    Returns:
        Tuple of (success: bool, message: str)
    """
    try:
        # Create IMAP client
        if is_ssl:
            client = aioimaplib.IMAP4_SSL(host=host, port=port)
        else:
            client = aioimaplib.IMAP4(host=host, port=port)

        # Connect with timeout
        await client.wait_hello_from_server()

        # Login
        response = await client.login(email, password)
        if response.result != "OK":
            return False, f"Login failed: {response.text}"

        # Logout
        await client.logout()

        return True, "Connection successful"

    except asyncio.TimeoutError:
        return False, "Connection timed out"
    except Exception as e:
        return False, f"Connection failed: {str(e)}"


async def fetch_mailboxes(
    host: str, port: int, is_ssl: bool, email: str, password: str
) -> tuple[list[str], str]:
    """
    Fetch list of mailboxes/folders from IMAP server.

    Returns:
        Tuple of (mailbox_names: list[str], message: str)
    """
    try:
        # Create IMAP client
        if is_ssl:
            client = aioimaplib.IMAP4_SSL(host=host, port=port)
        else:
            client = aioimaplib.IMAP4(host=host, port=port)

        # Connect
        await client.wait_hello_from_server()

        # Login
        response = await client.login(email, password)
        if response.result != "OK":
            return [], f"Login failed: {response.text}"

        # List mailboxes
        response = await client.list('""', '"*"')
        if response.result != "OK":
            return [], f"Failed to list mailboxes: {response}"

        # Parse mailbox names from response
        mailboxes = []
        for line in response.lines:
            decoded = line.decode("utf-8", errors="ignore")
            if not re.match(r"^\(\\.*\)", decoded):
                continue
            mailboxes.append(decoded.split()[-1])

        # Logout
        await client.logout()

        return mailboxes, "Success"

    except asyncio.TimeoutError:
        return [], "Connection timed out"
    except Exception as e:
        return [], f"Failed to fetch mailboxes: {str(e)}"
