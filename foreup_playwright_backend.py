"""
ForeUp booking backend — Playwright version.

Uses a real headless browser instead of raw HTTP requests, bypassing
ForeUp's IP-level block of GitHub Actions datacenter ranges.

Same public interface as foreup_backend.py:
  _fetch_available_tee_times(date, players) -> list[dict]
  _make_reservation(date, time, players, player_names, member_id) -> dict

Strategy
--------
1. Launch Chromium (looks like a real Mac/Chrome user → not blocked).
2. Navigate to the ForeUp booking page to seed the browser context.
3. Call the ForeUp API *from inside the browser* via page.evaluate(fetch(…)).
   The browser's own network stack, TLS fingerprint, and cookie jar are
   used, so requests are indistinguishable from the Angular app's own calls.
4. Return the parsed results.

This avoids:
  - Angular's date-routing quirks (the hash fragment is not reliable).
  - Fragile UI-element selectors.
  - The TCP-level IP block that affects raw Python requests.
"""

import logging
import os
from datetime import datetime
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

log = logging.getLogger(__name__)

FACILITY_ID = os.getenv("FOREUP_FACILITY_ID", "22052")
SCHEDULE_ID = os.getenv("FOREUP_SCHEDULE_ID", "9710")
BOOKING_CLASS = "memberwebsite"
DEBUG_DIR = Path(__file__).parent / "debug_screenshots"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _screenshot(page: Page, label: str) -> None:
    DEBUG_DIR.mkdir(exist_ok=True)
    path = DEBUG_DIR / f"fm_{label}_{datetime.now().strftime('%H%M%S')}.png"
    try:
        page.screenshot(path=str(path), full_page=True)
        log.debug("Screenshot: %s", path)
    except Exception:
        pass


def _foreup_date(date: str) -> str:
    """YYYY-MM-DD → MM-DD-YYYY (ForeUp API format)."""
    return datetime.strptime(date, "%Y-%m-%d").strftime("%m-%d-%Y")


def _display_time(raw: str) -> str:
    """Parse various ForeUp time formats → '10:30 AM'.

    Unauthenticated API calls return full datetime strings ('2026-08-01 10:21').
    Authenticated calls return plain time strings ('10:21' or '10:21:00').
    """
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def _new_context(pw):
    """Create a browser context that looks like a real Mac/Chrome user."""
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 900},
        locale="en-US",
        timezone_id="America/New_York",
    )
    return browser, ctx


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def _login(page: Page) -> bool:
    """
    Log in to ForeUp by calling the login API via fetch() inside the browser.

    Running fetch() from within the page inherits the browser's cookie jar and
    TLS fingerprint, so the server's Set-Cookie response is stored automatically.
    Subsequent fetch() calls in the same context will be authenticated.

    Returns True on apparent success (customer_id present in response).
    """
    username = os.getenv("GOLF_CLUB_USERNAME", "")
    password = os.getenv("GOLF_CLUB_PASSWORD", "")
    log.info("Logging in as %s via in-page fetch", username)
    _screenshot(page, "01_pre_login")

    try:
        result = page.evaluate("""
            async ([u, p]) => {
                try {
                    const resp = await fetch('/index.php/api/booking/users/login', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                        },
                        body: 'username=' + encodeURIComponent(u)
                            + '&password=' + encodeURIComponent(p)
                            + '&api_key=no_limits',
                    });
                    const data = await resp.json();
                    return {ok: resp.ok, status: resp.status, data: data};
                } catch(e) {
                    return {ok: false, error: String(e)};
                }
            }
        """, [username, password])

        user_data = result.get("data") or {}
        customer_id = user_data.get("customer_id") or user_data.get("id")
        log.info("Login fetch: ok=%s status=%s customer_id=%s",
                 result.get("ok"), result.get("status"), customer_id or "n/a")

        if not result.get("ok"):
            log.warning("Login response not-ok: %s", str(result.get("data", {}))[:300])
            return False

        if not customer_id and not user_data.get("token"):
            log.warning("Login response missing customer_id/token: %s",
                        str(user_data)[:300])
            return False

        # Mirror into localStorage so Angular's $localStorage sees the session
        # without needing a full page reload.
        page.evaluate("""
            (d) => {
                try { localStorage.setItem('ngStorage-user', JSON.stringify(d)); } catch(_) {}
                try { localStorage.setItem('fg_user',        JSON.stringify(d)); } catch(_) {}
            }
        """, user_data)
        log.info("Login OK — customer_id=%s", customer_id)
        return True

    except Exception as exc:
        log.warning("Login fetch exception: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Direct API helpers (run inside the browser via page.evaluate)
# ---------------------------------------------------------------------------

_FETCH_TIMES_JS = """
    async ([date, players, scheduleId, facilityId, bookingClass]) => {
        const params = new URLSearchParams({
            time: 'all',
            date: date,
            holes: 'all',
            players: String(players),
            booking_class: bookingClass,
            schedule_id: scheduleId,
            'schedule_ids[]': scheduleId,
            specials_only: '0',
            api_key: 'no_limits',
            facility_id: facilityId,
        });
        try {
            const resp = await fetch('/index.php/api/booking/times?' + params, {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                },
            });
            const data = await resp.json();
            return {ok: resp.ok, status: resp.status, data: data};
        } catch(e) {
            return {ok: false, error: String(e)};
        }
    }
"""

_RESERVE_JS = """
    async ([payload]) => {
        try {
            const resp = await fetch('/index.php/api/booking/users/reservations', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                },
                body: JSON.stringify(payload),
            });
            const data = await resp.json();
            return {ok: resp.ok, status: resp.status, data: data};
        } catch(e) {
            return {ok: false, error: String(e)};
        }
    }
"""


def _browser_fetch_times(page: Page, foreup_fmt: str, players: int) -> list:
    """Call the ForeUp times API from within the browser and return raw items."""
    result = page.evaluate(
        _FETCH_TIMES_JS,
        [foreup_fmt, players, SCHEDULE_ID, FACILITY_ID, BOOKING_CLASS],
    )
    log.info("Times fetch: ok=%s status=%s", result.get("ok"), result.get("status"))
    raw = result.get("data")
    if isinstance(raw, list):
        log.info("  → %d raw items", len(raw))
        return raw
    log.warning("Unexpected times response: %s", str(raw)[:300])
    return []


# ---------------------------------------------------------------------------
# Fetch tee times
# ---------------------------------------------------------------------------

def _fetch_available_tee_times(date: str, players: int) -> list[dict]:
    foreup_fmt = _foreup_date(date)

    with sync_playwright() as pw:
        browser, bctx = _new_context(pw)
        page = bctx.new_page()

        try:
            # Navigate to the booking page to seed the browser context/cookies
            base_url = (
                f"https://foreupsoftware.com/index.php/booking/"
                f"{FACILITY_ID}/{SCHEDULE_ID}"
            )
            log.info("Loading base page: %s", base_url)
            page.goto(base_url, wait_until="networkidle", timeout=45_000)
            page.wait_for_timeout(2000)
            _screenshot(page, "01_initial")

            # Log in; this sets the session cookie in the browser context
            _login(page)
            _screenshot(page, "02_post_login")

            # Fetch tee times via the authenticated browser context
            log.info("Fetching times for %s (%d players)", foreup_fmt, players)
            raw_times = _browser_fetch_times(page, foreup_fmt, players)
            _screenshot(page, "03_times_fetched")

            # Build slot list
            slots = []
            for item in raw_times:
                if not isinstance(item, dict) or not item.get("time"):
                    continue
                avail = item.get("available_spots") or item.get("spots") or 4
                try:
                    avail = int(avail)
                except (ValueError, TypeError):
                    avail = 4
                if avail < players:
                    continue
                slots.append({
                    "time": _display_time(item["time"]),
                    "price_per_player": item.get("green_fee", "?"),
                    "cart_included": bool(item.get("cart_included", False)),
                    "available_spots": avail,
                    "raw": item,
                })

            log.info("ForeUp Playwright: %d slot(s) for %s (%d players)",
                     len(slots), date, players)
            return slots

        except Exception as exc:
            log.error("Fetch error: %s", exc)
            _screenshot(page, "error_fetch")
            return []
        finally:
            browser.close()


# ---------------------------------------------------------------------------
# Make reservation
# ---------------------------------------------------------------------------

def _make_reservation(
    date: str,
    time: str,
    players: int,
    player_names: list[str],
    member_id: str = "",
) -> dict:
    foreup_fmt = _foreup_date(date)

    with sync_playwright() as pw:
        browser, bctx = _new_context(pw)
        page = bctx.new_page()

        try:
            base_url = (
                f"https://foreupsoftware.com/index.php/booking/"
                f"{FACILITY_ID}/{SCHEDULE_ID}"
            )
            log.info("Loading base page: %s", base_url)
            page.goto(base_url, wait_until="networkidle", timeout=45_000)
            page.wait_for_timeout(2000)

            ok = _login(page)
            if not ok:
                return {"success": False, "message": "Login failed — check credentials"}

            # Fetch available times to locate the target slot's raw data
            log.info("Fetching times to locate slot '%s' on %s", time, foreup_fmt)
            raw_times = _browser_fetch_times(page, foreup_fmt, players)

            target_slot = next(
                (item for item in raw_times
                 if _display_time(item.get("time", "")) == time),
                None,
            )
            if not target_slot:
                return {
                    "success": False,
                    "message": f"Slot '{time}' not found on {date}",
                }

            # Build reservation payload
            payload: dict = {
                **target_slot,
                "time": target_slot["time"],
                "date": foreup_fmt,
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

            log.info("Submitting reservation for %s at %s (%d players)", date, time, players)
            reserve_result = page.evaluate(_RESERVE_JS, [payload])
            log.info("Reserve fetch: ok=%s status=%s",
                     reserve_result.get("ok"), reserve_result.get("status"))
            _screenshot(page, "04_post_reserve")

            result_data = reserve_result.get("data") or {}
            log.info("Reserve response: %s", str(result_data)[:400])

            booking_id = (
                result_data.get("booking_id")
                or result_data.get("id")
                or result_data.get("reservation_id")
                or result_data.get("tee_time_id")
            )
            if booking_id:
                return {
                    "success": True,
                    "message": f"Reserved {date} at {time}",
                    "confirmation_number": str(booking_id),
                }

            error = (
                result_data.get("error")
                or result_data.get("message")
                or str(result_data)
            )
            return {"success": False, "message": error}

        except Exception as exc:
            log.error("Reserve error: %s", exc)
            _screenshot(page, "error_reserve")
            return {"success": False, "message": str(exc)}
        finally:
            browser.close()
