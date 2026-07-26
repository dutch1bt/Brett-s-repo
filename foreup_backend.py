"""
ForeUp booking backend.

Implements the same interface as lakeland_backend.py:
  _fetch_available_tee_times(date, players) -> list[dict]
  _make_reservation(date, time, players, player_names, member_id) -> dict
"""

import logging
import os
from datetime import datetime

import requests

log = logging.getLogger(__name__)

FACILITY_ID = os.getenv("FOREUP_FACILITY_ID", "22052")
SCHEDULE_ID = os.getenv("FOREUP_SCHEDULE_ID", "9710")
BASE_URL = "https://foreupsoftware.com/index.php/api"
BOOKING_CLASS = "memberwebsite"


def _session() -> tuple[requests.Session, dict]:
    """Login and return (session, user_data)."""
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
    })

    username = os.getenv("GOLF_CLUB_USERNAME", "")
    password = os.getenv("GOLF_CLUB_PASSWORD", "")

    resp = s.post(
        f"{BASE_URL}/booking/login",
        data={
            "username": username,
            "password": password,
            "booking_class": BOOKING_CLASS,
            "api_key": "no_limits",
        },
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    log.info("ForeUp login: customer_id=%s", data.get("customer_id") or data.get("id"))

    if not (data.get("customer_id") or data.get("id") or data.get("token")):
        raise RuntimeError(f"ForeUp login failed: {data}")

    return s, data


def _foreup_date(date: str) -> str:
    """Convert YYYY-MM-DD → MM-DD-YYYY for ForeUp."""
    return datetime.strptime(date, "%Y-%m-%d").strftime("%m-%d-%Y")


def _display_time(raw: str) -> str:
    """Convert ForeUp HH:MM(:SS) → '10:30 AM'."""
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def _fetch_times(session: requests.Session, date: str, players: int) -> list:
    resp = session.get(
        f"{BASE_URL}/booking/times",
        params={
            "time": "all",
            "date": _foreup_date(date),
            "holes": "18",
            "players": str(players),
            "booking_class": BOOKING_CLASS,
            "schedule_id": SCHEDULE_ID,
            "schedule_ids[]": SCHEDULE_ID,
            "specials_only": "0",
            "api_key": "no_limits",
            "facility_id": FACILITY_ID,
        },
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json() if isinstance(resp.json(), list) else []


def _fetch_available_tee_times(date: str, players: int) -> list[dict]:
    try:
        session, _ = _session()
        raw_times = _fetch_times(session, date, players)
    except Exception as exc:
        log.error("ForeUp fetch error: %s", exc)
        return []

    slots = []
    for item in raw_times:
        slots.append({
            "time": _display_time(item.get("time", "")),
            "price_per_player": item.get("green_fee", "?"),
            "cart_included": bool(item.get("cart_included", False)),
            "raw": item,
        })

    log.info("ForeUp: %d slot(s) found for %s (%d players)", len(slots), date, players)
    return slots


def _make_reservation(
    date: str,
    time: str,
    players: int,
    player_names: list[str],
    member_id: str = "",
) -> dict:
    try:
        session, user = _session()
        raw_times = _fetch_times(session, date, players)
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    # Match the chosen display time back to a raw slot
    target_slot = next(
        (item for item in raw_times if _display_time(item.get("time", "")) == time),
        None,
    )
    if not target_slot:
        return {"success": False, "message": f"Slot '{time}' not found on {date}"}

    try:
        payload = {
            "time": target_slot["time"],
            "date": _foreup_date(date),
            "players": players,
            "holes": 18,
            "schedule_id": SCHEDULE_ID,
            "schedule_ids[]": SCHEDULE_ID,
            "booking_class": BOOKING_CLASS,
            "api_key": "no_limits",
            "facility_id": FACILITY_ID,
        }
        for i, name in enumerate(player_names[:players], 1):
            payload[f"player{i}"] = name

        resp = session.post(
            f"{BASE_URL}/booking/reserve",
            data=payload,
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        log.info("ForeUp reserve response: %s", result)
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    booking_id = (
        result.get("booking_id")
        or result.get("id")
        or result.get("reservation_id")
        or result.get("tee_time_id")
    )
    if booking_id:
        return {
            "success": True,
            "message": f"Reserved {date} at {time}",
            "confirmation_number": str(booking_id),
        }

    error = result.get("error") or result.get("message") or str(result)
    return {"success": False, "message": error}
