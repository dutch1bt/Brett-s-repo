"""
Automatic Sunday Tee Time Reserver

Designed to be run by cron at the exact moment your club opens reservations
(typically midnight or a set hour, exactly 2 weeks in advance).

Checks availability for the Sunday that is exactly 14 days from today,
then books the first available slot. Logs every run to auto_reserve.log.

Usage:
    python auto_reserve.py [--dry-run]

    --dry-run  Check availability and log what would be booked, but don't
               actually submit the reservation. Useful for testing.

Cron setup (see bottom of this file for instructions).
"""

import argparse
import logging
import os
import sys
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

def run(dry_run: bool = False) -> int:
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

    # 2. Fetch the first available slot
    slot = first_available_slot(date, PLAYERS)
    if not slot:
        log.error("No available tee times on %s for %d player(s). No reservation made.", date, PLAYERS)
        return 1

    log.info(
        "First available slot: %s — $%s/player, cart %s",
        slot["time"],
        slot["price_per_player"],
        "included" if slot["cart_included"] else "not included",
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
    args = parser.parse_args()

    sys.exit(run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------------------
# CRON SETUP
# ---------------------------------------------------------------------------
#
# Your club opens reservations at a fixed time exactly 14 days in advance.
# You need cron to fire this script at that exact minute, every Sunday.
#
# Step 1 — find your Python path:
#   which python3
#
# Step 2 — edit your crontab:
#   crontab -e
#
# Step 3 — add a line using this template:
#
#   MINUTE HOUR * * 0 /path/to/python3 /path/to/auto_reserve.py >> /path/to/auto_reserve.log 2>&1
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
