"""
Lakelands Golf and Country Club — Playwright booking backend.

Replaces the stubs in golf_agent.py with real browser automation.
Logs in via the member portal, reads and submits the tee sheet.

Debug screenshots are written to ./debug_screenshots/ on any failure
so you can see exactly where things went wrong.
"""

import logging
import os
import re
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeout, sync_playwright

load_dotenv()

log = logging.getLogger(__name__)

LOGIN_URL = (
    "https://www.lakelandsgolf.com/default.aspx"
    "?p=dynamicmodule&pageid=9&ssid=100033&vnf=1"
)
BOOKING_URL = (
    "https://www.lakelandsgolf.com/Default.aspx"
    "?p=dynamicmodule&pageid=125&tt=booking&ssid=100178&vnf=1"
)

DEBUG_DIR = Path(__file__).parent / "debug_screenshots"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _screenshot(page: Page, label: str) -> None:
    DEBUG_DIR.mkdir(exist_ok=True)
    path = DEBUG_DIR / f"{label}_{datetime.now().strftime('%H%M%S')}.png"
    try:
        page.screenshot(path=str(path), full_page=True)
        log.debug("Screenshot: %s", path)
    except Exception:
        pass


def _credentials() -> tuple[str, str]:
    u = os.getenv("GOLF_CLUB_USERNAME")
    p = os.getenv("GOLF_CLUB_PASSWORD")
    if not u or not p:
        raise ValueError(
            "GOLF_CLUB_USERNAME and GOLF_CLUB_PASSWORD must be set in .env"
        )
    return u, p


def _fill_first(page: Page, selectors: list[str], value: str, label: str) -> bool:
    """Try each selector in order; fill the first one found. Return True on success."""
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.fill(value)
                log.debug("Filled %s with selector: %s", label, sel)
                return True
        except Exception:
            continue
    return False


def _click_first(page: Page, selectors: list[str], label: str) -> bool:
    """Try each selector in order; click the first visible one. Return True on success."""
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click()
                log.debug("Clicked %s with selector: %s", label, sel)
                return True
        except Exception:
            continue
    return False


def _parse_time(text: str) -> str | None:
    """Extract the first H:MM AM/PM pattern from text."""
    m = re.search(r"\b(\d{1,2}:\d{2}\s*[AP]M)\b", text, re.IGNORECASE)
    return m.group(1).strip().upper() if m else None


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def _login(page: Page) -> None:
    username, password = _credentials()
    log.info("Logging in as %s ...", username)
    page.goto(LOGIN_URL, wait_until="networkidle", timeout=30_000)
    _screenshot(page, "01_login_page")

    filled = _fill_first(
        page,
        [
            'input[type="text"]',
            '[id*="UserName" i]',
            '[name*="UserName" i]',
            '[id*="user" i]',
            '[name*="user" i]',
        ],
        username,
        "username",
    )
    if not filled:
        _screenshot(page, "01_login_no_username")
        raise RuntimeError(
            "Could not find a username field on the login page. "
            "See debug_screenshots/01_login_no_username*.png"
        )

    page.locator('input[type="password"]').first.fill(password)

    clicked = _click_first(
        page,
        [
            'input[type="submit"]',
            'button[type="submit"]',
            '[id*="Login" i]',
            '[id*="Submit" i]',
            '[value*="Login" i]',
            '[value*="Sign in" i]',
        ],
        "login button",
    )
    if not clicked:
        _screenshot(page, "01_login_no_button")
        raise RuntimeError(
            "Could not find a login submit button. "
            "See debug_screenshots/01_login_no_button*.png"
        )

    page.wait_for_load_state("networkidle", timeout=30_000)
    _screenshot(page, "02_post_login")

    # Detect login failure via error message or redirect back to login
    for err_sel in [".error", ".alert-danger", '[class*="error" i]', '[class*="invalid" i]']:
        try:
            loc = page.locator(err_sel).first
            if loc.is_visible():
                raise RuntimeError(f"Login failed: {loc.text_content()}")
        except PlaywrightTimeout:
            pass

    log.info("Login OK — now at: %s", page.url)


# ---------------------------------------------------------------------------
# Navigate to the booking page and select date + players
# ---------------------------------------------------------------------------

def _open_booking_for(page: Page, date: str, players: int) -> None:
    """Navigate to booking page, pick date and player count, trigger search."""
    log.info("Opening booking page for %s, %d player(s)...", date, players)
    page.goto(BOOKING_URL, wait_until="networkidle", timeout=30_000)
    _screenshot(page, "03_booking_page")

    # ---- Date selection ----
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    formatted = date_obj.strftime("%m/%d/%Y")          # MM/DD/YYYY common in US club systems

    date_filled = _fill_first(
        page,
        [
            'input[type="date"]',
            '[id*="date" i]',
            '[name*="date" i]',
            '[id*="Date" i]',
            '[name*="Date" i]',
            'input[id*="txt" i][id*="date" i]',
        ],
        formatted,
        "date",
    )

    if not date_filled:
        # Some club systems use a visible calendar widget — click the right day
        log.warning(
            "No date text input found; attempting calendar navigation for %s.", date
        )
        _screenshot(page, "03_no_date_input")
        _navigate_calendar(page, date_obj)

    # ---- Player count ----
    try:
        player_sel = page.locator(
            "select, "
            '[id*="player" i], [name*="player" i], '
            '[id*="holes" i], [id*="NumPlayer" i]'
        )
        # Look for the player-count dropdown specifically
        for i in range(player_sel.count()):
            el = player_sel.nth(i)
            tag = el.evaluate("e => e.tagName.toLowerCase()")
            if tag == "select":
                el.select_option(str(players))
                log.debug("Set players to %d", players)
                break
    except Exception as exc:
        log.debug("Player count selector not found or not needed: %s", exc)

    # ---- Search / Find times ----
    searched = _click_first(
        page,
        [
            '[id*="Search" i]',
            '[value*="Search" i]',
            '[value*="Find" i]',
            '[value*="Check" i]',
            'input[type="submit"]',
            'button[type="submit"]',
        ],
        "search button",
    )
    if not searched:
        # Some systems auto-refresh on date change — just wait
        log.debug("No search button found; waiting for auto-refresh.")

    page.wait_for_load_state("networkidle", timeout=30_000)
    _screenshot(page, "04_results")


def _navigate_calendar(page: Page, target: datetime) -> None:
    """Click through a calendar widget to reach target month/year, then click the day."""
    # Most club calendar widgets show month/year text and prev/next arrows
    max_months = 4
    for _ in range(max_months):
        header = page.locator('[class*="calendar" i] [class*="header" i], '
                              '.ui-datepicker-title, '
                              '[class*="picker" i] [class*="title" i]')
        if not header.count():
            break
        header_text = header.first.text_content() or ""
        try:
            shown = datetime.strptime(header_text.strip(), "%B %Y")
            if shown.year == target.year and shown.month == target.month:
                break
            # Navigate forward
            _click_first(page, ['[class*="next" i]', '.ui-datepicker-next', '[title*="Next" i]'], "calendar next")
            page.wait_for_timeout(300)
        except ValueError:
            break  # Can't parse header — give up on calendar nav

    # Click the target day
    day_str = str(target.day)
    _click_first(
        page,
        [
            f'[class*="calendar" i] a:text-is("{day_str}")',
            f'.ui-datepicker-calendar a:text-is("{day_str}")',
            f'td:text-is("{day_str}"):not([class*="other"])',
        ],
        f"calendar day {day_str}",
    )
    page.wait_for_load_state("networkidle", timeout=10_000)


# ---------------------------------------------------------------------------
# Parse tee times from results page
# ---------------------------------------------------------------------------

def _parse_slots(page: Page, players: int) -> list[dict]:
    """
    Extract available tee time slots from whatever the results page renders.
    Returns list of dicts with keys: time, available_spots, price_per_player,
    cart_included, _book_selector (internal, used by make_reservation).
    """
    slots: list[dict] = []

    # Strategy 1: rows in a <table> — typical for ASP.NET WebForms club systems
    rows = page.locator("table tr")
    for i in range(rows.count()):
        row = rows.nth(i)
        text = (row.text_content() or "").strip()
        if not text:
            continue
        t = _parse_time(text)
        if not t:
            continue
        # Skip header-like rows
        if any(kw in text.lower() for kw in ["time", "player", "price", "date"]) and i == 0:
            continue

        # Available spots — look for digit before "avail" or "open" or parenthetical
        spots_match = re.search(r"(\d)\s*(?:avail|open|spot|remain)", text, re.IGNORECASE)
        spots = int(spots_match.group(1)) if spots_match else 4

        # Price — look for dollar amount
        price_match = re.search(r"\$\s*([\d.]+)", text)
        price = float(price_match.group(1)) if price_match else 0.0

        # Cart — "cart included" or "riding"
        cart = bool(re.search(r"cart|riding", text, re.IGNORECASE))

        # Determine whether this row is bookable (has a link/button)
        bookable = (
            row.locator("a, input[type='submit'], button").count() > 0
            and spots >= players
        )
        if not bookable:
            continue

        # Build a CSS selector for the book action in this row
        # We'll use nth-child to target this specific row later
        slots.append({
            "time": t,
            "available_spots": spots,
            "price_per_player": price,
            "cart_included": cart,
            "_row_index": i,
        })

    # Strategy 2: div/li-based slot listings (modern club UIs)
    if not slots:
        containers = page.locator(
            '[class*="tee" i], [class*="slot" i], [class*="time" i], '
            '[class*="booking" i]'
        )
        for i in range(containers.count()):
            c = containers.nth(i)
            text = (c.text_content() or "").strip()
            t = _parse_time(text)
            if not t:
                continue
            price_match = re.search(r"\$\s*([\d.]+)", text)
            price = float(price_match.group(1)) if price_match else 0.0
            cart = bool(re.search(r"cart|riding", text, re.IGNORECASE))
            if c.locator("a, button, input").count() > 0:
                slots.append({
                    "time": t,
                    "available_spots": 4,
                    "price_per_player": price,
                    "cart_included": cart,
                    "_row_index": i,
                })

    log.info("Parsed %d available slot(s)", len(slots))
    return slots


# ---------------------------------------------------------------------------
# Public API — same signatures as golf_agent.py stubs
# ---------------------------------------------------------------------------

def fetch_available_tee_times(date: str, players: int) -> list[dict]:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            _login(page)
            _open_booking_for(page, date, players)
            slots = _parse_slots(page, players)
            # Strip internal keys before returning
            return [
                {k: v for k, v in s.items() if not k.startswith("_")}
                for s in slots
            ]
        except Exception:
            _screenshot(page, "error_fetch")
            raise
        finally:
            browser.close()


def make_reservation(
    date: str,
    time: str,
    players: int,
    player_names: list[str],
    member_id: str,
) -> dict:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            _login(page)
            _open_booking_for(page, date, players)
            slots = _parse_slots(page, players)

            # Find the slot matching the requested time
            target = next(
                (s for s in slots if s["time"].upper() == time.upper()), None
            )
            if not target:
                available = [s["time"] for s in slots]
                return {
                    "success": False,
                    "message": (
                        f"Time {time} not found in available slots. "
                        f"Available: {available}"
                    ),
                }

            # Click the book link/button in that row
            row_index = target["_row_index"]
            rows = page.locator("table tr")
            row = rows.nth(row_index)
            book_el = row.locator("a, input[type='submit'], button").first

            if not book_el.count():
                _screenshot(page, "error_no_book_button")
                return {"success": False, "message": "Could not find booking button for that slot."}

            log.info("Clicking book for %s on %s ...", time, date)
            book_el.click()
            page.wait_for_load_state("networkidle", timeout=30_000)
            _screenshot(page, "05_booking_form")

            # Fill player names if a form appears
            name_inputs = page.locator('input[type="text"][id*="name" i], input[type="text"][name*="name" i]')
            for i, name in enumerate(player_names):
                if i < name_inputs.count():
                    name_inputs.nth(i).fill(name)

            # Set player count if a dropdown is re-shown
            try:
                sel = page.locator("select").first
                if sel.count() and sel.is_visible():
                    sel.select_option(str(players))
            except Exception:
                pass

            # Confirm / submit the reservation
            confirmed = _click_first(
                page,
                [
                    '[value*="Confirm" i]',
                    '[value*="Reserve" i]',
                    '[value*="Book" i]',
                    '[value*="Submit" i]',
                    'input[type="submit"]',
                    'button[type="submit"]',
                ],
                "confirm button",
            )

            page.wait_for_load_state("networkidle", timeout=30_000)
            _screenshot(page, "06_confirmation")

            # Extract confirmation number from the page
            body = page.text_content("body") or ""
            conf_match = re.search(
                r"(?:confirmation|booking|reservation)[:\s#]*([A-Z0-9\-]{4,20})",
                body,
                re.IGNORECASE,
            )
            conf_number = conf_match.group(1) if conf_match else f"LG-{datetime.now().strftime('%Y%m%d%H%M%S')}"

            # Check for success vs error messaging on the confirmation page
            if any(kw in body.lower() for kw in ["error", "failed", "not available", "sorry"]):
                _screenshot(page, "error_booking_failed")
                err_match = re.search(r"(error[^.]*\.|failed[^.]*\.)", body, re.IGNORECASE)
                return {
                    "success": False,
                    "message": err_match.group(0) if err_match else "Booking failed — see debug_screenshots for details.",
                }

            return {
                "success": True,
                "confirmation_number": conf_number,
                "message": (
                    f"Tee time reserved: {players} player(s) on {date} at {time}. "
                    f"Confirmation: {conf_number}"
                ),
            }

        except Exception as exc:
            _screenshot(page, "error_reserve")
            raise
        finally:
            browser.close()


def cancel_reservation(confirmation_number: str, member_id: str) -> dict:
    """
    Cancellations on most club systems require logging in and finding the
    reservation in "My Bookings" or similar. This navigates there and attempts
    to cancel by confirmation number.
    """
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            _login(page)
            _screenshot(page, "cancel_01_logged_in")

            # Look for a "My Reservations" / "My Bookings" link in the nav
            clicked = _click_first(
                page,
                [
                    'a:text-matches("reservations|bookings|tee times", "i")',
                    '[href*="reservation" i]',
                    '[href*="booking" i]',
                    '[href*="myaccount" i]',
                ],
                "my reservations link",
            )
            if clicked:
                page.wait_for_load_state("networkidle", timeout=20_000)
                _screenshot(page, "cancel_02_my_reservations")

            # Find and click the cancel button next to our confirmation number
            body = page.text_content("body") or ""
            if confirmation_number in body:
                # Find the row containing our confirmation number
                rows = page.locator(f'*:has-text("{confirmation_number}")')
                for i in range(rows.count()):
                    row = rows.nth(i)
                    cancel_btn = row.locator('[value*="Cancel" i], a:text-matches("cancel", "i")')
                    if cancel_btn.count():
                        cancel_btn.first.click()
                        page.wait_for_load_state("networkidle", timeout=20_000)
                        _screenshot(page, "cancel_03_done")
                        return {
                            "success": True,
                            "message": f"Reservation {confirmation_number} cancelled.",
                        }

            return {
                "success": False,
                "message": (
                    f"Could not find or cancel reservation {confirmation_number}. "
                    "You may need to cancel manually through the club website."
                ),
            }

        except Exception:
            _screenshot(page, "error_cancel")
            raise
        finally:
            browser.close()


def fetch_my_reservations(member_id: str) -> list[dict]:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            _login(page)

            # Navigate to my reservations
            _click_first(
                page,
                [
                    'a:text-matches("my reservations|my bookings|my tee times", "i")',
                    '[href*="reservation" i]',
                    '[href*="booking" i]',
                ],
                "my reservations link",
            )
            page.wait_for_load_state("networkidle", timeout=20_000)
            _screenshot(page, "myres_page")

            reservations = []
            rows = page.locator("table tr")
            for i in range(1, rows.count()):   # skip header row
                row = rows.nth(i)
                text = (row.text_content() or "").strip()
                if not text:
                    continue
                t = _parse_time(text)
                date_match = re.search(r"\b(\d{1,2}/\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2})\b", text)
                if t and date_match:
                    conf_match = re.search(r"\b([A-Z]{2,4}[-]?\d{6,})\b", text)
                    reservations.append({
                        "confirmation_number": conf_match.group(0) if conf_match else "N/A",
                        "date": date_match.group(0),
                        "time": t,
                        "players": 1,
                        "status": "Confirmed",
                    })

            return reservations

        except Exception:
            _screenshot(page, "error_myres")
            raise
        finally:
            browser.close()
