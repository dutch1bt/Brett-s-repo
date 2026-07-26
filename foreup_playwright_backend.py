"""
ForeUp booking backend — Playwright version.

Uses a real headless browser instead of raw HTTP requests, bypassing
ForeUp's IP-level block of GitHub Actions datacenter ranges.

Same public interface as foreup_backend.py:
  _fetch_available_tee_times(date, players) -> list[dict]
  _make_reservation(date, time, players, player_names, member_id) -> dict
"""

import logging
import os
import re
from datetime import datetime
from pathlib import Path

from playwright.sync_api import Page, sync_playwright, TimeoutError as PlaywrightTimeout

log = logging.getLogger(__name__)

FACILITY_ID = os.getenv("FOREUP_FACILITY_ID", "22052")
SCHEDULE_ID = os.getenv("FOREUP_SCHEDULE_ID", "9710")
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
    """YYYY-MM-DD → MM-DD-YYYY (ForeUp URL/API format)."""
    return datetime.strptime(date, "%Y-%m-%d").strftime("%m-%d-%Y")


def _display_time(raw: str) -> str:
    """HH:MM(:SS) → '10:30 AM'."""
    for fmt in ("%H:%M:%S", "%H:%M"):
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

def _login(page: Page) -> None:
    """Log in to ForeUp through the browser UI."""
    username = os.getenv("GOLF_CLUB_USERNAME", "")
    password = os.getenv("GOLF_CLUB_PASSWORD", "")
    log.info("Logging in as %s", username)

    _screenshot(page, "01_pre_login")

    # Click the Login link/button
    for sel in [
        "text=Login", "text=Log In", "text=Sign In",
        "a:has-text('Login')", "button:has-text('Login')",
        ".login-link", ".login-btn", "[ng-click*='login']",
        ".fa-sign-in-alt", ".glyphicon-user",
    ]:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click()
                log.info("Clicked login trigger: %s", sel)
                break
        except Exception:
            continue

    page.wait_for_timeout(2000)
    _screenshot(page, "02_login_modal")

    # Fill email / username
    for sel in [
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="user" i]',
        'input[name*="user" i]',
        'input[id*="user" i]',
        'input[type="text"]',
    ]:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.fill(username)
                log.info("Filled username via: %s", sel)
                break
        except Exception:
            continue

    # Fill password
    try:
        page.locator('input[type="password"]').first.fill(password)
    except Exception as e:
        log.warning("Could not fill password: %s", e)

    page.wait_for_timeout(300)

    # Submit
    for sel in [
        'button[type="submit"]',
        'input[type="submit"]',
        "button:has-text('Login')",
        "button:has-text('Log In')",
        "button:has-text('Sign In')",
        "[ng-click*='login']",
        ".btn-login", ".btn-primary",
    ]:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click()
                log.info("Submitted login via: %s", sel)
                break
        except Exception:
            continue

    page.wait_for_timeout(4000)
    try:
        page.wait_for_load_state("networkidle", timeout=15_000)
    except Exception:
        pass
    _screenshot(page, "03_post_login")
    log.info("After login: %s", page.url)


def _is_logged_in(page: Page) -> bool:
    for sel in [
        ".logout", "text=Logout", "text=Log Out",
        ".user-name", ".member-name", ".logged-in-user",
        "[ng-show*='loggedIn']", "[ng-if*='loggedIn']",
    ]:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                return True
        except Exception:
            continue
    return False


# ---------------------------------------------------------------------------
# Fetch tee times
# ---------------------------------------------------------------------------

def _fetch_available_tee_times(date: str, players: int) -> list[dict]:
    foreup_fmt = _foreup_date(date)
    captured: list[dict] = []

    def on_response(resp):
        if "/booking/times" in resp.url:
            log.info("API response: %s %s", resp.status, resp.url)
            try:
                data = resp.json()
                if isinstance(data, list):
                    captured.extend(data)
                    log.info("  → captured %d time items", len(data))
            except Exception as e:
                log.debug("  → JSON parse failed: %s", e)

    with sync_playwright() as pw:
        browser, bctx = _new_context(pw)
        page = bctx.new_page()
        page.on("response", on_response)

        try:
            url = (
                f"https://foreupsoftware.com/index.php/booking/"
                f"{FACILITY_ID}/{SCHEDULE_ID}#teetimes/{foreup_fmt}"
            )
            log.info("Loading: %s", url)
            page.goto(url, wait_until="networkidle", timeout=45_000)
            page.wait_for_timeout(3000)
            _screenshot(page, "01_initial")

            if not _is_logged_in(page):
                _login(page)
                # Re-navigate after login so the date-specific times load
                page.goto(url, wait_until="networkidle", timeout=30_000)
                page.wait_for_timeout(3000)
                _screenshot(page, "04_post_login_nav")

            # Give Angular time to fetch and render times
            page.wait_for_timeout(2000)
            _screenshot(page, "05_times_page")

            if not captured:
                log.warning("No API responses captured — trying page text fallback")
                # Fallback: scrape times from DOM
                body = page.evaluate("document.body.innerText") or ""
                log.info("Page text (500): %r", body[:500])

            # Build slot list from captured API data
            slots = []
            for item in captured:
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

            log.info("ForeUp Playwright: %d slot(s) for %s (%d players)", len(slots), date, players)
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
    captured: list[dict] = []

    def on_response(resp):
        if "/booking/times" in resp.url:
            try:
                data = resp.json()
                if isinstance(data, list):
                    captured.extend(data)
            except Exception:
                pass

    with sync_playwright() as pw:
        browser, bctx = _new_context(pw)
        page = bctx.new_page()
        page.on("response", on_response)

        try:
            url = (
                f"https://foreupsoftware.com/index.php/booking/"
                f"{FACILITY_ID}/{SCHEDULE_ID}#teetimes/{foreup_fmt}"
            )
            page.goto(url, wait_until="networkidle", timeout=45_000)
            page.wait_for_timeout(3000)

            if not _is_logged_in(page):
                _login(page)
                page.goto(url, wait_until="networkidle", timeout=30_000)
                page.wait_for_timeout(3000)

            _screenshot(page, "05_booking_page")

            # --- Find and click the target time slot ---
            # ForeUp renders times as Angular components. Try multiple selectors.
            time_upper = time.upper()
            time_12h_alt = time  # e.g. '10:30 AM'

            clicked_slot = False
            for sel in [
                f"text='{time_upper}'",
                f"text='{time_12h_alt}'",
                f".booking-start-time:has-text('{time_upper}')",
                f".time:has-text('{time_upper}')",
                f"[class*='time']:has-text('{time_upper}')",
                f"td:has-text('{time_upper}')",
                f"li:has-text('{time_upper}')",
            ]:
                try:
                    loc = page.locator(sel).first
                    if loc.count() and loc.is_visible():
                        # Look for a Book button adjacent to this time
                        container = loc.locator(
                            "xpath=ancestor::*[contains(@class,'tee') "
                            "or contains(@class,'slot') "
                            "or contains(@class,'row') "
                            "or contains(@class,'booking')][1]"
                        ).first
                        book_btn = container.locator(
                            "text='Book', button:has-text('Book'), "
                            "[ng-click*='book'], .btn-book"
                        ).first
                        if book_btn.count() and book_btn.is_visible():
                            book_btn.click()
                            log.info("Clicked Book button for %s", time)
                        else:
                            loc.click()
                            log.info("Clicked time element for %s", time)
                        clicked_slot = True
                        break
                except Exception:
                    continue

            if not clicked_slot:
                log.warning("Could not find time slot %s on page", time)
                _screenshot(page, "error_no_slot")
                return {
                    "success": False,
                    "message": f"Could not find time slot {time} on the booking page.",
                }

            page.wait_for_timeout(2000)
            _screenshot(page, "06_booking_form")

            # --- Set player count if there's a selector ---
            for sel in [
                f"select option[value='{players}']",
                f"[ng-model*='players'] option[value='{players}']",
                f"select[name*='players']",
            ]:
                try:
                    loc = page.locator(f"select:has(option[value='{players}'])").first
                    if loc.count() and loc.is_visible():
                        loc.select_option(str(players))
                        log.info("Set player count to %d", players)
                        break
                except Exception:
                    continue

            page.wait_for_timeout(500)

            # --- Submit ---
            submitted = False
            for sel in [
                "button:has-text('Book')",
                "button:has-text('Reserve')",
                "button:has-text('Confirm')",
                "button:has-text('Complete')",
                "button:has-text('Submit')",
                "[ng-click*='book']",
                "[ng-click*='reserve']",
                "[ng-click*='confirm']",
                ".btn-book", ".btn-reserve", ".btn-confirm",
                'button[type="submit"]',
                'input[type="submit"]',
            ]:
                try:
                    loc = page.locator(sel).first
                    if loc.count() and loc.is_visible():
                        loc.click()
                        log.info("Submitted via: %s", sel)
                        submitted = True
                        break
                except Exception:
                    continue

            if not submitted:
                log.warning("Could not find submit button — logging visible buttons")
                btns = page.evaluate("""
                    () => [...document.querySelectorAll('button,input[type=submit],a.btn')]
                        .filter(el => el.offsetParent)
                        .map(el => ({tag: el.tagName, text: (el.textContent||el.value||'').trim().slice(0,60)}))
                """)
                for b in btns:
                    log.info("  Visible button: %s %r", b['tag'], b['text'])

            page.wait_for_timeout(5000)
            try:
                page.wait_for_load_state("networkidle", timeout=20_000)
            except Exception:
                pass
            _screenshot(page, "07_confirmation")

            body = page.evaluate("document.body.innerText") or ""
            log.info("Post-booking text (600): %r", body[:600])

            # Look for confirmation number
            conf_match = re.search(
                r"(?:confirmation|booking|reservation)[:\s#]*([A-Z0-9\-]{4,20})"
                r"|#\s*(\d{5,})",
                body, re.IGNORECASE,
            )
            if conf_match:
                conf_number = conf_match.group(1) or conf_match.group(2)
                return {
                    "success": True,
                    "confirmation_number": conf_number,
                    "message": f"Reserved {date} at {time}",
                }

            # Accept generic success words
            if any(w in body.lower() for w in ["confirmed", "booked", "reserved", "success", "thank you"]):
                return {
                    "success": True,
                    "confirmation_number": "BOOKED",
                    "message": f"Reserved {date} at {time} — check email for confirmation number",
                }

            _screenshot(page, "error_no_confirmation")
            return {
                "success": False,
                "message": (
                    f"Booking submitted but could not confirm success. "
                    f"Page text: {body[:300]}"
                ),
            }

        except Exception as exc:
            log.error("Reserve error: %s", exc)
            _screenshot(page, "error_reserve")
            return {"success": False, "message": str(exc)}
        finally:
            browser.close()
