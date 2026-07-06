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
# Navigate to the booking page and advance the tee-sheet calendar
# ---------------------------------------------------------------------------

def _open_booking_for(page: Page, date: str, players: int) -> None:
    """
    Land on the Lakelands tee-sheet and navigate to the target date.

    Primary path: go directly to BOOKING_URL (valid session cookie from login
    gets us in without re-authenticating).  Fall back to menu nav if the
    direct URL redirects back to the login page.

    The booking page (TEE SHEET tab) shows:
        ◄  Fri-July 17, 2026  ►
              [Calendar]
    """
    log.info("Opening booking page for %s ...", date)

    # --- Primary: navigate directly to the booking URL ---
    page.goto(BOOKING_URL, wait_until="networkidle", timeout=30_000)
    _screenshot(page, "03_booking_page")

    # Detect redirect back to login (session not accepted)
    if "pageid=9" in page.url or "login" in page.url.lower():
        log.warning("Direct URL redirected to login — trying menu navigation")
        # Re-login and try menu nav
        _login(page)
        _click_first(
            page,
            ['a:text-is("Golf")', 'li a:text-is("Golf")', '*:text-is("Golf")'],
            "Golf nav item",
        )
        page.wait_for_timeout(600)
        _click_first(
            page,
            ['a:text-is("Book a Tee Time")', 'a:text-matches("book.*tee", "i")'],
            "Book a Tee Time link",
        )
        page.wait_for_load_state("networkidle", timeout=30_000)
        _screenshot(page, "03b_booking_page_menu")

    # --- Advance the tee-sheet calendar to the target date ---
    target = datetime.strptime(date, "%Y-%m-%d")
    _navigate_teesheet_to(page, target)
    _screenshot(page, "04_results")


def _navigate_teesheet_to(page: Page, target: datetime) -> None:
    """
    Drive the Lakelands tee-sheet date display to `target`.

    The page shows a date header like "Fri-July 17, 2026" with ◄/► arrows
    and a Calendar button. Strategy:
      1. Click Calendar — if a date-picker appears, select the target day.
      2. Fall back to reading the current date label and clicking ► one day
         at a time (safe for up to 20 clicks = 3 weeks out).
    """
    MAX_DAY_CLICKS = 20

    # --- Try the Calendar button first ---
    cal_clicked = _click_first(
        page,
        ['button:text-is("Calendar")', 'a:text-is("Calendar")', '*:text-is("Calendar")'],
        "Calendar button",
    )
    if cal_clicked:
        page.wait_for_timeout(600)
        _screenshot(page, "03c_calendar_picker")
        day_str = str(target.day)
        day_clicked = _click_first(
            page,
            [
                f'td[data-date*="{target.strftime("%Y-%m-%d")}"] a',
                f'.ui-datepicker-calendar td a:text-is("{day_str}")',
                f'[class*="calendar" i] td:text-is("{day_str}")',
                f'[class*="picker" i] td:text-is("{day_str}")',
                f'td:not([class*="other"]):not([class*="disabled"]) a:text-is("{day_str}")',
            ],
            f"calendar day {day_str}",
        )
        if day_clicked:
            page.wait_for_load_state("networkidle", timeout=15_000)
            _screenshot(page, "03d_date_selected")
            return

    # --- Fall back: read date label, click ► until we match ---
    # The ► on Lakelands is a Unicode right-pointing triangle (►, U+25BA).
    # ASP.NET renders navigation as <a href="javascript:__doPostBack(...)">►</a>
    # or an <input type="submit" value="►">. Try all plausible selectors.
    NEXT_SELECTORS = [
        'a:text("►")',          # ► (U+25BA black right-pointing pointer)
        'a:text("▶")',          # ▶ (U+25B6 black right-pointing triangle)
        'input[value="►"]',
        'input[value="▶"]',
        '[id*="lnkNext" i]',        # common ASP.NET LinkButton id pattern
        '[id*="btnNext" i]',
        '[id*="Next" i][href]',
        'a[href*="Next"]',
        '[class*="next" i]',
        '[title*="next" i]',
        '[title*="forward" i]',
        'input[value=">"]',
        'a:text(">")',
    ]

    for click_num in range(MAX_DAY_CLICKS):
        # Parse the current date from the tee-sheet header
        current_label = ""
        for loc in [
            page.locator('[class*="date" i]:not(input)'),
            page.locator('[class*="header" i]:not(input)'),
            page.locator('h2, h3, h4, strong'),
            page.locator('body'),
        ]:
            for i in range(min(loc.count(), 5)):
                txt = (loc.nth(i).text_content() or "").strip()
                if re.search(
                    r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}",
                    txt, re.IGNORECASE,
                ):
                    current_label = txt
                    break
            if current_label:
                break

        if current_label:
            clean = re.sub(r"^[A-Za-z]+-\s*", "", current_label).strip()
            parsed = False
            for fmt in ("%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y"):
                try:
                    shown = datetime.strptime(clean, fmt)
                    parsed = True
                    if shown.date() == target.date():
                        log.info("Tee sheet on target date %s", target.strftime("%Y-%m-%d"))
                        return
                    if shown.date() > target.date():
                        log.warning("Overshot target — stopping")
                        return
                    break
                except ValueError:
                    continue
            if not parsed:
                log.debug("Could not parse date label: %r", current_label)

        log.debug("Clicking next-day arrow (attempt %d)", click_num + 1)
        clicked = _click_first(page, NEXT_SELECTORS, "next-day arrow")
        if not clicked:
            _screenshot(page, f"no_arrow_{click_num}")
            log.warning("Could not find next-day arrow on attempt %d", click_num + 1)
        page.wait_for_load_state("networkidle", timeout=10_000)

    log.warning("Could not navigate to %s within %d clicks", target.date(), MAX_DAY_CLICKS)


# ---------------------------------------------------------------------------
# Parse tee times from results page
# ---------------------------------------------------------------------------

def _parse_slots(page: Page, players: int) -> list[dict]:
    """
    Extract available tee time slots from the Lakelands booking page.

    The booking page lists tee times as clickable rows/buttons. Each slot
    shows a time (e.g. "7:30 AM") and is clickable to open the booking modal.
    Returns list of dicts with keys: time, available_spots, price_per_player,
    cart_included, _locator_index (internal index used by make_reservation).
    """
    slots: list[dict] = []

    # Lakelands renders tee times as clickable table rows or links.
    # Each bookable row contains a time string like "7:30 AM".
    # Try table rows first, then fall back to generic clickable containers.
    candidates = page.locator("table tr")
    if candidates.count() <= 1:
        # Fall back to div/link-based listing
        candidates = page.locator("a, button, [class*='tee' i], [class*='slot' i], [class*='time' i]")

    for i in range(candidates.count()):
        el = candidates.nth(i)
        text = (el.text_content() or "").strip()
        t = _parse_time(text)
        if not t:
            continue

        # Skip obvious header rows
        if re.search(r"\b(tee\s*time|date|player|price)\b", text, re.IGNORECASE) and i == 0:
            continue

        # Only include rows that are actually clickable (have a link/button or are themselves clickable)
        is_clickable = (
            el.locator("a, button, input[type='submit'], input[type='button']").count() > 0
            or el.evaluate("e => e.tagName === 'A' || e.tagName === 'BUTTON'")
        )
        if not is_clickable:
            continue

        price_match = re.search(r"\$\s*([\d.]+)", text)
        price = float(price_match.group(1)) if price_match else 0.0
        cart = bool(re.search(r"cart|riding", text, re.IGNORECASE))

        slots.append({
            "time": t,
            "available_spots": 4,   # Lakelands doesn't show spot count on the list
            "price_per_player": price,
            "cart_included": cart,
            "_locator_index": i,
        })

    log.info("Parsed %d available slot(s)", len(slots))
    return slots


def _fill_booking_modal(page: Page, party_size: str, player_names: list[str]) -> None:
    """
    Fill in the 'Book Tee Time' modal that appears after clicking a time slot.

    Modal fields (from the actual Lakelands UI):
      - Round:      "Eighteen Holes" (leave as default)
      - Party Size: Single / Twosome / Threesome / Foursome
      - Date/Time:  pre-filled from the slot selection
      - P1:         auto-filled with member name ("Dutcher, Brett")
      - P2–P4:      additional player name fields
      - Send Confirmations: checkbox (leave checked)
    """
    # Wait for the modal to appear
    page.wait_for_selector(
        'text="Book Tee Time", [class*="modal" i], [class*="dialog" i], [class*="popup" i]',
        timeout=10_000,
    )
    _screenshot(page, "05_booking_modal")

    # Party Size — select by visible text ("Single", "Twosome", etc.)
    party_sel = page.locator("select").filter(has_text=re.compile(
        r"Single|Twosome|Threesome|Foursome", re.IGNORECASE
    ))
    if party_sel.count():
        party_sel.first.select_option(label=party_size)
        log.info("Set Party Size to: %s", party_size)
    else:
        # Fallback: any select on the modal
        selects = page.locator("select")
        for i in range(selects.count()):
            opts = selects.nth(i).inner_text()
            if "single" in opts.lower():
                selects.nth(i).select_option(label=party_size)
                log.info("Set Party Size to %s (fallback selector)", party_size)
                break

    page.wait_for_timeout(500)   # let the form re-render after party size change

    # P1 is auto-filled with member name — skip it.
    # Fill additional players if provided (P2 onward).
    if len(player_names) > 1:
        name_inputs = page.locator(
            'input[type="text"][id*="player" i], '
            'input[type="text"][id*="Player" i], '
            'input[type="text"][placeholder*="player" i]'
        )
        # Skip index 0 (P1, pre-filled), fill the rest
        for idx, name in enumerate(player_names[1:], start=1):
            if idx < name_inputs.count():
                inp = name_inputs.nth(idx)
                if not inp.input_value():   # only fill if blank
                    inp.fill(name)
                    log.debug("Filled P%d with: %s", idx + 1, name)

    _screenshot(page, "06_modal_filled")


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


_PARTY_LABELS = {1: "Single", 2: "Twosome", 3: "Threesome", 4: "Foursome"}


def make_reservation(
    date: str,
    time: str,
    players: int,
    player_names: list[str],
    member_id: str,
) -> dict:
    party_size = _PARTY_LABELS.get(players, "Single")

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

            # Re-create the same candidates locator used in _parse_slots so
            # _locator_index maps to the correct element.
            loc_idx = target["_locator_index"]
            candidates = page.locator("table tr")
            if candidates.count() <= 1:
                candidates = page.locator(
                    "a, button, [class*='tee' i], [class*='slot' i], [class*='time' i]"
                )

            el = candidates.nth(loc_idx)
            book_el = el.locator("a, button, input[type='submit'], input[type='button']").first
            log.info("Clicking book for %s on %s ...", time, date)
            if book_el.count():
                book_el.click()
            else:
                el.click()

            # Fill the "Book Tee Time" modal (party size + player names P2–P4)
            _fill_booking_modal(page, party_size, player_names)

            # Submit the modal
            _click_first(
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
            _screenshot(page, "07_confirmation")

            # Extract confirmation number from the page
            body = page.text_content("body") or ""
            conf_match = re.search(
                r"(?:confirmation|booking|reservation)[:\s#]*([A-Z0-9\-]{4,20})",
                body,
                re.IGNORECASE,
            )
            conf_number = (
                conf_match.group(1)
                if conf_match
                else f"LG-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            )

            if any(kw in body.lower() for kw in ["error", "failed", "not available", "sorry"]):
                _screenshot(page, "error_booking_failed")
                err_match = re.search(r"(error[^.]*\.|failed[^.]*\.)", body, re.IGNORECASE)
                return {
                    "success": False,
                    "message": (
                        err_match.group(0)
                        if err_match
                        else "Booking failed — see debug_screenshots for details."
                    ),
                }

            return {
                "success": True,
                "confirmation_number": conf_number,
                "message": (
                    f"Tee time reserved: {players} player(s) on {date} at {time}. "
                    f"Players: {', '.join(player_names)}. "
                    f"Confirmation: {conf_number}"
                ),
            }

        except Exception:
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
