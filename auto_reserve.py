"""
Automatic Sunday Tee Time Reserver

Designed to be run by cron slightly BEFORE the exact moment your club opens
reservations (2 weeks in advance). Use --early-seconds to control how many
seconds before the window opens to start the script (default: 45).

The script pre-authenticates while waiting, then fires the booking request
at the exact right second for maximum speed.

Usage:
    python auto_reserve.py [--dry-run] [--early-seconds 45]

    --dry-run        Check availability and log what would be booked, but don't
                     submit. Useful for testing.
    --early-seconds  How many seconds before the window opens to start the
                     script (default 45). Set your cron job this many seconds
                     early and pass the same value here.

Cron setup (see bottom of this file for instructions).
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timedelta

from dotenv import load_dotenv

import golf_agent

load_dotenv()

# ---------------------------------------------------------------------------
# CONFIGURATION — set via .env or environment variables
# ---------------------------------------------------------------------------

PLAYERS: int = int(os.getenv("AUTO_RESERVE_PLAYERS", "1"))

# Comma-separated player names, e.g. "Brett,John,Sarah"
_raw_names = os.getenv("AUTO_RESERVE_PLAYER_NAMES", "")
PLAYER_NAMES: list[str] = [n.strip() for n in _raw_names.split(",") if n.strip()]

# If player names aren't configured, fall back to member ID as sole name
if not PLAYER_NAMES:
    PLAYER_NAMES = [os.getenv("GOLF_CLUB_MEMBER_ID", "Member")]

# ---------------------------------------------------------------------------
# LOGGING — appends to auto_reserve.log next to this script
# ---------------------------------------------------------------------------

LOG_FILE = os.path.join(os.path.dirname(__file__), "auto_reserve.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def target_sunday() -> str:
    """Return the date of the Sunday exactly 14 days from today (YYYY-MM-DD)."""
    today = datetime.now().date()
    target = today + timedelta(days=14)
    if target.weekday() != 6:  # 6 = Sunday
        raise ValueError(
            f"Today is {today.strftime('%A')} — target date {target} is not a Sunday. "
            "This script expects to run on a Sunday so the target is also a Sunday."
        )
    return target.strftime("%Y-%m-%d")


def first_available_slot(date: str, players: int) -> dict | None:
    """Return the earliest available tee time slot, or None if none exist."""
    slots = golf_agent._fetch_available_tee_times(date, players)
    return slots[0] if slots else None


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def _wait_for_booking_window(early_seconds: int) -> None:
    """
    If the script was started `early_seconds` before the booking window opens,
    sleep until exactly the right moment.

    Cron fires at HH:MM:00. If early_seconds=45, set the cron job 45 seconds
    early (HH:MM-1:15 or use `* * * * * sleep 15 && python ...`) and pass
    --early-seconds 45. This function sleeps off the gap so that the booking
    request hits the server right as the window opens.
    """
    if early_seconds <= 0:
        return
    now = datetime.now()
    # Target = top of the current minute + (60 - early_seconds) seconds
    # e.g. if early_seconds=45 and now is HH:MM:00, wake at HH:MM:15
    seconds_into_minute = now.second + now.microsecond / 1_000_000
    target_seconds = 60 - early_seconds
    sleep_for = target_seconds - seconds_into_minute
    if sleep_for > 0:
        log.info("Waiting %.1fs for booking window to open...", sleep_for)
        time.sleep(sleep_for)
    log.info("Booking window open — proceeding at %s", datetime.now().strftime("%H:%M:%S.%f")[:-3])


def run(dry_run: bool = False, early_seconds: int = 0) -> int:
    """
    Execute the auto-reserve flow. Returns 0 on success, 1 on failure.
    Called directly by cron — exit code matters for monitoring.
    """
    member_id = os.getenv("GOLF_CLUB_MEMBER_ID", "DEMO_MEMBER")
    club_name = os.getenv("GOLF_CLUB_NAME", "the Golf Club")

    log.info("=== Auto-reserve started%s ===", " [DRY RUN]" if dry_run else "")
    log.info("Club: %s | Member: %s | Players: %d (%s)",
             club_name, member_id, PLAYERS, ", ".join(PLAYER_NAMES))

    # 1. Determine target date
    try:
        date = target_sunday()
    except ValueError as e:
        log.error("Date error: %s", e)
        return 1

    log.info("Target Sunday: %s", date)

    # 2. Pre-authenticate while waiting for the booking window
    #    (Playwright backend will log in during fetch; for the race we warm up here)
    if early_seconds > 0 and golf_agent._USING_REAL_BACKEND:
        log.info("Pre-authenticating %ds before booking window...", early_seconds)
        try:
            import lakeland_backend as _lb
            from playwright.sync_api import sync_playwright
            _pw = sync_playwright().start()
            _browser = _pw.chromium.launch(headless=True)
            _page = _browser.new_page()
            _lb._login(_page)
            log.info("Pre-auth complete.")
            _wait_for_booking_window(early_seconds)
            # Now fetch from the already-logged-in page directly
            _lb._open_booking_for(_page, date, PLAYERS)
            slots = _lb._parse_slots(_page, PLAYERS)
            _browser.close()
            _pw.stop()
        except Exception as exc:
            log.warning("Pre-auth race failed (%s); falling back to normal flow.", exc)
            _wait_for_booking_window(early_seconds)
            slots = golf_agent._fetch_available_tee_times(date, PLAYERS)
    else:
        _wait_for_booking_window(early_seconds)
        slots = golf_agent._fetch_available_tee_times(date, PLAYERS)

    if not slots:
        log.error("No available tee times on %s for %d player(s). No reservation made.", date, PLAYERS)
        return 1

    slot = slots[0]
    log.info(
        "First available slot: %s — $%s/player, cart %s",
        slot["time"],
        slot.get("price_per_player", "?"),
        "included" if slot.get("cart_included") else "not included",
    )

    # 3. Book it (unless dry run)
    if dry_run:
        log.info("DRY RUN — would reserve %s on %s for %s.", slot["time"], date, ", ".join(PLAYER_NAMES))
        return 0

    result = golf_agent._make_reservation(
        date=date,
        time=slot["time"],
        players=PLAYERS,
        player_names=PLAYER_NAMES,
        member_id=member_id,
    )

    if result.get("success"):
        log.info("SUCCESS — %s", result["message"])
        log.info("Confirmation number: %s", result["confirmation_number"])
        return 0
    else:
        log.error("Reservation FAILED: %s", result.get("message", "unknown error"))
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Auto-reserve the first Sunday tee time 2 weeks out.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Check availability but do not submit the reservation.")
    parser.add_argument("--early-seconds", type=int, default=0, metavar="N",
                        help="Start N seconds before the booking window opens (default 0). "
                             "Set your cron job N seconds early and pass this flag.")
    args = parser.parse_args()

    sys.exit(run(dry_run=args.dry_run, early_seconds=args.early_seconds))


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------------------
# CRON SETUP
# ---------------------------------------------------------------------------
#
# Lakelands opens reservations exactly 2 weeks in advance on the minute.
# You want this script to fire 45 seconds BEFORE that minute so it can
# pre-authenticate, then hit the booking the instant the window opens.
#
# Step 1 — find your Python path:
#   which python3
#
# Step 2 — edit your crontab:
#   crontab -e
#
# Step 3 — add this line (adjust HOUR/MINUTE to 45s before your club's opening time).
#
# Example: club opens at 7:00 AM → start at 6:59:15 → cron at 6:59, --early-seconds 45
#
#   59 6 * * 0 /usr/bin/python3 /home/brett/golf/auto_reserve.py --early-seconds 45
#
# Or if the club opens at midnight (0:00):
#
#   59 23 * * 6 /usr/bin/python3 /home/brett/golf/auto_reserve.py --early-seconds 45
#   (note: Saturday 23:59 fires 45s before Sunday midnight)
#
#   Field breakdown:
#     MINUTE  — the exact minute the booking window opens (e.g. 0)
#     HOUR    — the exact hour  the booking window opens (e.g. 7 for 7:00 AM)
#     * * 0   — every Sunday (0 = Sunday in cron)
#
# Example: club opens at 7:00 AM every Sunday, script lives in ~/golf:
#
#   0 7 * * 0 /usr/bin/python3 /home/brett/golf/auto_reserve.py >> /home/brett/golf/auto_reserve.log 2>&1
#
# Step 4 — make sure the script's .env file is present next to auto_reserve.py
#          (cron runs without your shell environment, so dotenv is required).
#
# Step 5 — test it right now without waiting for Sunday:
#
#   python auto_reserve.py --dry-run
#
# To verify cron is running, check auto_reserve.log after the scheduled time.
