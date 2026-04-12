"""CLI commands for the Hopthu email client."""

import asyncio
import signal
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
import traceback

import click
from sqlalchemy import select
from aioimaplib import aioimaplib

from hopthu.app import config
from hopthu.app.db import AsyncSession
from hopthu.app.models import Account, Mailbox
from hopthu.app.services.sync import sync_account, sync_all


async def connect_to_imap(account, password):
    """Establish IMAP connection for an account."""
    try:
        if account.is_ssl:
            client = aioimaplib.IMAP4_SSL(host=account.host, port=account.port)
        else:
            client = aioimaplib.IMAP4(host=account.host, port=account.port)

        await client.wait_hello_from_server()
        await client.login(account.email, password)
        return client
    except Exception as e:
        print(f"IMAP connection failed for {account.email}: {e}")
        return None


async def monitor_mailbox_idle(client, mailbox_name, account_id, password, interval=60):
    """Monitor a single mailbox using IDLE command with periodic fallback sync."""
    print(f"Monitoring mailbox '{mailbox_name}' for account {account_id}")

    while True:
        try:
            # Select the mailbox
            resp_code, capabilities = await client.select(mailbox_name)
            if resp_code != "OK":
                print(f"Failed to select mailbox {mailbox_name}: {capabilities}")
                break

            # Enter IDLE mode
            await client.idle_start()
            print(f"Entered IDLE mode for mailbox '{mailbox_name}'")

            # Wait for new messages or timeout after 'interval' seconds
            try:
                await asyncio.wait_for(client.wait_server_push(), timeout=interval)
                print(
                    f"Activity detected in mailbox '{mailbox_name}', processing new messages..."
                )

                # Stop IDLE and process new messages
                client.idle_done()

                # Sync the account to get new messages
                sync_result = await sync_account(account_id)

                if "error" not in sync_result:
                    print(
                        f"Synced {sync_result.get('synced', 0)} messages, "
                        f"skipped {sync_result.get('skipped', 0)} for account {account_id}"
                    )

                    # Note: Email processing (parsing and triggering) happens automatically
                    # within sync_account during email creation
                    if sync_result.get("synced", 0) > 0:
                        print(
                            f"New emails processed and triggers executed for account {account_id}"
                        )
                else:
                    print(
                        f"Sync error for account {account_id}: {sync_result['error']}"
                    )

            except asyncio.TimeoutError:
                # Timeout occurred - no activity, exit IDLE and continue monitoring
                print(
                    f"No activity in mailbox '{mailbox_name}' after {interval}s, returning to IDLE..."
                )
                try:
                    client.idle_done()
                except Exception:
                    # If idle_done fails, we might need to reconnect
                    pass

        except asyncio.TimeoutError:
            # Handle timeout from the select command
            print(f"Timeout selecting mailbox '{mailbox_name}', reconnecting...")
            break
        except Exception as e:
            print(f"Error monitoring mailbox '{mailbox_name}': {e}")
            traceback.print_exc()

            # Exit the loop to allow reconnection at the account level
            break

        # Brief pause before re-entering IDLE
        await asyncio.sleep(1)


async def monitor_account(account, password, interval=60):
    """Monitor all active mailboxes for a single account using IDLE."""
    while True:  # Reconnection loop
        client = await connect_to_imap(account, password)
        if not client:
            print(
                f"Failed to connect to account {account.email}, waiting before retry..."
            )
            await asyncio.sleep(30)  # Wait before retrying
            continue  # Retry connection

        try:
            # Get active mailboxes for this account
            async with AsyncSession() as session:
                result = await session.execute(
                    select(Mailbox).where(
                        Mailbox.account_id == account.id, Mailbox.is_active
                    )
                )
                mailboxes = result.scalars().all()

            if not mailboxes:
                print(f"No active mailboxes for account {account.email}, skipping...")
                return

            # Monitor each active mailbox
            tasks = []
            for mailbox in mailboxes:
                task = asyncio.create_task(
                    monitor_mailbox_idle(
                        client, mailbox.name, account.id, password, interval
                    )
                )
                tasks.append(task)

            # Wait for all mailbox monitors (they run indefinitely)
            if tasks:
                # If any task fails, we'll exit the loop to reconnect
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Check if any of the tasks had exceptions
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        print(
                            f"Exception in mailbox monitor {mailboxes[i].name}: {result}"
                        )

                # If we get here, it means one of the tasks ended (likely due to connection issue)
                print(
                    f"One or more mailbox monitors ended for account {account.email}, reconnecting..."
                )

        finally:
            try:
                await client.logout()
            except Exception:
                pass

        # Wait before reconnecting
        await asyncio.sleep(5)


@click.command()
@click.option(
    "--interval",
    default=60,
    help="Fallback sync interval in seconds when IDLE is not available (default: 60)",
)
@click.option(
    "--mode",
    default="idle",
    type=click.Choice(["poll", "idle"]),
    help="Sync mode: poll (periodic sync) or idle (IMAP IDLE command) (default: idle)",
)
def sync_continuous(interval, mode):
    """Continuously sync emails from all accounts."""
    from hopthu.app import create_app

    app = create_app()

    async def run_sync():
        async with app.app_context():
            print(f"Starting continuous sync (mode: {mode}, interval: {interval}s)...")
            print("Press Ctrl+C to stop")

            # Handle graceful shutdown
            def signal_handler(signum, frame):
                print("\nShutting down gracefully...")
                sys.exit(0)

            signal.signal(signal.SIGINT, signal_handler)
            signal.signal(signal.SIGTERM, signal_handler)

            app_tz = ZoneInfo(config.QUART_TZ)

            # Get all accounts from the database
            async with AsyncSession() as session:
                result = await session.execute(select(Account))
                accounts = result.scalars().all()

            if not accounts:
                print("No accounts configured, exiting...")
                return

            if mode == "poll":
                # Traditional polling mode
                while True:
                    try:
                        print(
                            f"[{datetime.now(app_tz).isoformat()}] Starting sync cycle..."
                        )

                        # Sync all accounts
                        sync_results = await sync_all()

                        for account_id, result in sync_results.items():
                            if "error" in result:
                                print(
                                    f"Error syncing account {account_id}: {result['error']}"
                                )
                            else:
                                print(
                                    f"Account {account_id}: Synced {result.get('synced', 0)} emails, "
                                    f"skipped {result.get('skipped', 0)}"
                                )

                        print(
                            f"[{datetime.now(app_tz).isoformat()}] Waiting {interval}s for next sync..."
                        )
                        await asyncio.sleep(interval)

                    except KeyboardInterrupt:
                        print("\nShutting down gracefully...")
                        break

                    except Exception as e:
                        print(f"Unexpected error during sync: {e}")
                        traceback.print_exc()
                        await asyncio.sleep(min(interval, 30))  # Shorter sleep on error

            elif mode == "idle":
                # IDLE mode - establish persistent connections
                try:
                    tasks = []
                    for account in accounts:
                        try:
                            password = config.decrypt_credential(account.credential)
                            task = asyncio.create_task(
                                monitor_account(account, password, interval)
                            )
                            tasks.append(task)
                        except Exception as e:
                            print(
                                f"Failed to start monitoring for account {account.email}: {e}"
                            )

                    if tasks:
                        await asyncio.gather(*tasks, return_exceptions=True)
                    else:
                        print("No accounts could be monitored, exiting...")

                except KeyboardInterrupt:
                    print("\nShutting down gracefully...")

                except Exception as e:
                    print(f"Unexpected error in IDLE mode: {e}")
                    traceback.print_exc()

    # Run the async function
    asyncio.run(run_sync())


def register_cli_commands(app):
    """Register CLI commands with the Quart application."""
    app.cli.add_command(sync_continuous)
