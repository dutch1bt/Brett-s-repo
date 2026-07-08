"""
Fetch available tee times for a given date and write results to latest_times.json.
Used by the check_tee_times GitHub Actions workflow (Ask 1 Siri shortcut).

Usage:
    python check_tee_times.py YYYY-MM-DD
"""

import json
import os
import sys
from datetime import datetime

from dotenv import load_dotenv
import golf_agent

load_dotenv()

PLAYERS: int = int(os.getenv("AUTO_RESERVE_PLAYERS", "4"))
OUTPUT_FILE = "latest_times.json"


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: check_tee_times.py YYYY-MM-DD", file=sys.stderr)
        return 1

    date = sys.argv[1]
    checked_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    try:
        slots = golf_agent._fetch_available_tee_times(date, PLAYERS)
    except Exception as exc:
        result = {
            "date": date,
            "checked_at": checked_at,
            "error": str(exc),
            "earliest": None,
            "slots": [],
        }
        with open(OUTPUT_FILE, "w") as f:
            json.dump(result, f, indent=2)
        print(json.dumps(result, indent=2))
        return 1

    if slots:
        result = {
            "date": date,
            "checked_at": checked_at,
            "earliest": slots[0]["time"],
            "slots": [s["time"] for s in slots],
        }
    else:
        result = {
            "date": date,
            "checked_at": checked_at,
            "earliest": None,
            "slots": [],
            "message": "No available tee times for a foursome on this date.",
        }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(result, f, indent=2)

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
