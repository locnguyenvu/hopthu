"""Email sync service for fetching emails from IMAP."""

import asyncio
from datetime import datetime, timedelta
from email import message_from_bytes
from email.header import decode_header
from email.utils import parsedate_to_datetime, parseaddr
from zoneinfo import ZoneInfo

from aioimaplib import aioimaplib

from hopthu.app import config
from hopthu.app.db import AsyncSession
from hopthu.app.models import Account, Mailbox, Email


def decode_mime_header(header_value: str) -> str:
    """Decode MIME encoded header to utf-8 string."""
    if not header_value:
        return ""
    decoded_parts = []
    for part, charset in decode_header(header_value):
        if isinstance(part, bytes):
            try:
                decoded_parts.append(part.decode(charset or "utf-8", errors="ignore"))
            except Exception:
                decoded_parts.append(part.decode("utf-8", errors="ignore"))
        else:
            decoded_parts.append(part)
    return "".join(decoded_parts)


async def sync_account(account_id: int) -> dict:
    """
    Sync emails for a specific account.

    Returns:
        Dict with sync results
    """
    async with AsyncSession() as session:
        # Get account
        from sqlalchemy import select
        result = await session.execute(select(Account).where(Account.id == account_id))
        account = result.scalar_one_or_none()

        if not account:
            return {"error": "Account not found"}

        # Get active mailboxes
        result = await session.execute(
            select(Mailbox).where(
                Mailbox.account_id == account_id,
                Mailbox.is_active == 1
            )
        )
        mailboxes = result.scalars().all()

        if not mailboxes:
            return {"error": "No active mailboxes"}

        # Decrypt password
        try:
            password = config.decrypt_credential(account.credential)
        except Exception as e:
            return {"error": f"Failed to decrypt credential: {str(e)}"}

        # Connect to IMAP
        try:
            if account.is_ssl:
                client = aioimaplib.IMAP4_SSL(host=account.host, port=account.port)
            else:
                client = aioimaplib.IMAP4(host=account.host, port=account.port)

            await client.wait_hello_from_server()
            await client.login(account.email, password)
        except Exception as e:
            return {"error": f"IMAP connection failed: {str(e)}"}

        total_synced = 0
        total_skipped = 0

        app_tz = ZoneInfo(config.QUART_TZ)

        for mailbox in mailboxes:
            try:
                # Select mailbox
                response = await client.select(mailbox.name)
                if response.result != "OK":
                    continue

                # Search for messages from today
                today = datetime.now().strftime("%d-%b-%Y")
                response = await client.search(f"SINCE {today}")
                if response.result != "OK":
                    continue

                # Parse message IDs
                message_ids = response.lines[0].decode().split()
                # Limit to 20 most recent messages
                message_ids = message_ids[-20:] if len(message_ids) > 20 else message_ids

                for msg_id in message_ids:
                    # Fetch message headers first to check Message-ID
                    response = await client.fetch(msg_id, "(BODY.PEEK[HEADER.FIELDS (Message-ID)])")
                    if response.result != "OK":
                        continue

                    # Extract Message-ID from headers
                    # Skip IMAP protocol lines (first and last 2 lines)
                    header_lines = response.lines[1:-2] if len(response.lines) >= 3 else response.lines
                    header_data = b"\n".join(header_lines)
                    msg_header = message_from_bytes(header_data)
                    message_id = msg_header.get("Message-ID", "").strip()

                    if not message_id:
                        # Generate a fallback message ID
                        message_id = f"{account.email}-{msg_id}@{mailbox.name}"

                    # Check if email already exists
                    result = await session.execute(
                        select(Email).where(
                            Email.account_id == account_id,
                            Email.message_id == message_id
                        )
                    )
                    if result.scalar_one_or_none():
                        total_skipped += 1
                        continue

                    # Fetch full message
                    response = await client.fetch(msg_id, "(RFC822)")
                    if response.result != "OK":
                        continue

                    # Extract RFC822 content from IMAP response
                    # Response format: [<msgid> FETCH (RFC822 {<size>}, <content lines...>, b')', b'FETCH completed']
                    lines = response.lines
                    # Skip first line (FETCH header) and last 2 lines (b')' and status)
                    if len(lines) >= 3:
                        msg_lines = lines[1:-2]
                    else:
                        msg_lines = lines
                    msg_data = b"\n".join(msg_lines)
                    msg = message_from_bytes(msg_data)

                    # Extract email content (first text/plain or text/html part)
                    content_type = "text/plain"
                    body = ""

                    if msg.is_multipart():
                        for part in msg.walk():
                            ct = part.get_content_type()
                            if ct in ("text/plain", "text/html"):
                                content_type = ct
                                try:
                                    payload = part.get_payload(decode=True)
                                    body = payload.decode("utf-8", errors="ignore") if payload else ""
                                except Exception:
                                    payload = part.get_payload(decode=True)
                                    body = payload.decode("latin-1", errors="ignore") if payload else ""
                                break
                    else:
                        content_type = msg.get_content_type()
                        try:
                            payload = msg.get_payload(decode=True)
                            body = payload.decode("utf-8", errors="ignore") if payload else ""
                        except Exception:
                            payload = msg.get_payload(decode=True)
                            body = payload.decode("latin-1", errors="ignore") if payload else ""

                    # Parse date header
                    date_header = msg.get("Date")
                    try:
                        received_at = parsedate_to_datetime(date_header)
                        received_at = received_at.astimezone(app_tz)
                    except:
                        received_at = datetime.now(app_tz)

                    # Extract to_email using parseaddr
                    to_header = msg.get("To", "")
                    _, to_email = parseaddr(to_header)

                    # Decode subject with utf-8
                    subject = decode_mime_header(msg.get("Subject", ""))

                    # Extract from_email using parseaddr as well
                    from_header = msg.get("From", "")
                    _, from_email = parseaddr(from_header)

                    # Create email record
                    email = Email(
                        account_id=account_id,
                        mailbox_id=mailbox.id,
                        from_email=from_email,
                        to_email=to_email,
                        subject=subject,
                        content_type=content_type,
                        body=body,
                        message_id=message_id,
                        meta_data={"Message-ID": message_id},
                        status="new",
                        received_at=received_at,
                    )
                    session.add(email)
                    await session.flush()  # Get the email ID
                    total_synced += 1

                    # Process the email for data extraction
                    try:
                        from hopthu.app.services.parser import process_email
                        await process_email(email.id)
                    except Exception as e:
                        print(f"Error processing email {email.id}: {e}")
                        # Continue syncing other emails even if processing fails

                await session.commit()

            except Exception as e:
                print(f"Error syncing mailbox {mailbox.name}: {e}")
                continue

        # Logout
        try:
            await client.logout()
        except:
            pass

        return {
            "synced": total_synced,
            "skipped": total_skipped,
        }


async def sync_all() -> dict:
    """
    Sync emails for all accounts.

    Returns:
        Dict with sync results per account
    """
    async with AsyncSession() as session:
        from sqlalchemy import select
        result = await session.execute(select(Account))
        accounts = result.scalars().all()

    results = {}
    for account in accounts:
        results[account.id] = await sync_account(account.id)

    return results
