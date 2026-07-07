"""
Automatic Sunday Tee Time Reserver — Lakelands Golf

Cron fires at 7:31 AM every Sunday. Books the 7:30 AM tee time on the
Sunday exactly 14 days out (Lakelands opens the booking window at 7:30 AM,
two weeks in advance).

Usage:
    python auto_reserve.py [--dry-run]

    --dry-run  Check availability and log what would be booked, but don't
               submit. Useful for testing.

Cron line (add via `crontab -e`):
    31 7 * * 0 /usr/bin/python3 /path/to/auto_reserve.py
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

PLAYERS: int = int(os.getenv("AUTO_RESERVE_PLAYERS", "4"))

# Comma-separated player names — P1 (Brett) is auto-filled by the club system;
# include all names here so they're logged and passed to the backend.
_raw_names = os.getenv(
    "AUTO_RESERVE_PLAYER_NAMES",
    "Brett,Brian Cogley,Rob Boss,Rocky Wiltsey",
)
PLAYER_NAMES: list[str] = [n.strip() for n in _raw_names.split(",") if n.strip()]

# If player names aren't configured, fall back to member ID as sole name
if not PLAYER_NAMES:
    PLAYER_NAMES = [os.getenv("GOLF_CLUB_MEMBER_ID", "Member")]

# Preferred tee time — book this slot if available, otherwise fall back to
# the earliest slot. Format must match what the booking site returns (e.g. "7:30 AM").
PREFERRED_TIME: str = os.getenv("AUTO_RESERVE_PREFERRED_TIME", "7:30 AM")

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


def pick_slot(slots: list[dict]) -> dict | None:
    """Return the earliest available slot."""
    return slots[0] if slots else None


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def run(dry_run: bool = False, date_override: str | None = None) -> int:
    """
    Execute the auto-reserve flow. Returns 0 on success, 1 on failure.
    Called directly by cron — exit code matters for monitoring.
    """
    club_name = os.getenv("GOLF_CLUB_NAME", "the Golf Club")

    log.info("=== Auto-reserve started%s ===", " [DRY RUN]" if dry_run else "")
    log.info("Club: %s | Players: %d (%s)",
             club_name, PLAYERS, ", ".join(PLAYER_NAMES))

    # 1. Determine target date
    if date_override:
        date = date_override
        log.info("Using override date: %s", date)
    else:
        try:
            date = target_sunday()
        except ValueError as e:
            log.error("Date error: %s", e)
            return 1

    log.info("Target Sunday: %s", date)

    # 2. Fetch available slots
    slots = golf_agent._fetch_available_tee_times(date, PLAYERS)
    if not slots:
        log.error("No available tee times on %s for %d player(s). No reservation made.", date, PLAYERS)
        return 1

    # 3. Pick the earliest available slot
    slot = pick_slot(slots)
    log.info(
        "Booking slot: %s — $%s/player, cart %s",
        slot["time"],
        slot.get("price_per_player", "?"),
        "included" if slot.get("cart_included") else "not included",
    )

    if dry_run:
        log.info("DRY RUN — would reserve %s on %s for %s.", slot["time"], date, ", ".join(PLAYER_NAMES))
        return 0

    # 4. Submit the reservation
    result = golf_agent._make_reservation(
        date=date,
        time=slot["time"],
        players=PLAYERS,
        player_names=PLAYER_NAMES,
        member_id=os.getenv("GOLF_CLUB_MEMBER_ID", ""),
    )

    if result.get("success"):
        log.info("SUCCESS — %s", result["message"])
        log.info("Confirmation number: %s", result["confirmation_number"])
        return 0
    else:
        log.error("Reservation FAILED: %s", result.get("message", "unknown error"))
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Auto-reserve the 7:30 AM Sunday tee time at Lakelands, 2 weeks out."
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Check availability but do not submit the reservation.")
    parser.add_argument("--date", metavar="YYYY-MM-DD",
                        help="Override the target date (skips the Sunday-14-day check). "
                             "Useful for one-off tests.")
    args = parser.parse_args()
    sys.exit(run(dry_run=args.dry_run, date_override=args.date))


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------------------
# CRON SETUP
# ---------------------------------------------------------------------------
#
# Lakelands opens at 7:30 AM on Sundays, 2 weeks in advance.
# We fire at 7:31 AM — one minute later — to let the window open cleanly.
#
# Step 1 — find your Python path:
#   which python3
#
# Step 2 — edit your crontab:
#   crontab -e
#
# Step 3 — add this exact line (update the path):
#
#   31 7 * * 0 /usr/bin/python3 /home/brett/golf/auto_reserve.py
#
#   Breakdown:  31 = minute, 7 = hour (7:31 AM), * * 0 = every Sunday
#
# Step 4 — verify .env is present next to this script (cron has no shell env).
#
# Step 5 — test without waiting for Sunday:
#   python auto_reserve.py --dry-run
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
