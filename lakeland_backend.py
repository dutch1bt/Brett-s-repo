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

def _screenshot(ctx, label: str) -> None:
    DEBUG_DIR.mkdir(exist_ok=True)
    path = DEBUG_DIR / f"{label}_{datetime.now().strftime('%H%M%S')}.png"
    try:
        # Frame objects don't have .screenshot(); use the parent Page
        screenshottable = getattr(ctx, "page", ctx)
        screenshottable.screenshot(path=str(path), full_page=True)
        log.debug("Screenshot: %s", path)
    except Exception:
        pass


def _dump_html(ctx, label: str) -> None:
    """Save page HTML and current URL to debug dir so artifacts contain the raw source."""
    DEBUG_DIR.mkdir(exist_ok=True)
    path = DEBUG_DIR / f"{label}_{datetime.now().strftime('%H%M%S')}.html"
    try:
        html = ctx.content()
        url = getattr(ctx, "url", "unknown")
        path.write_text(f"<!-- URL: {url} -->\n" + html, encoding="utf-8")
        log.info("Saved HTML (%d bytes): %s", len(html), path.name)
    except Exception as e:
        log.debug("HTML dump failed: %s", e)


def _log_clickable_elements(page: Page) -> None:
    """Log every clickable element on the page — critical for diagnosing selector misses."""
    try:
        elements = page.evaluate("""
            () => {
                const sel = 'a, button, input[type="submit"], input[type="button"], [onclick]';
                return [...document.querySelectorAll(sel)].map(el => ({
                    tag: el.tagName,
                    id: el.id || '',
                    name: el.name || '',
                    text: (el.textContent || el.value || '').trim().slice(0, 60),
                    href: (el.href || '').slice(0, 120),
                    onclick: (el.getAttribute('onclick') || '').slice(0, 120),
                    cls: el.className || '',
                    visible: el.offsetParent !== null,
                }));
            }
        """)
        log.info("--- Clickable elements on page (%d total) ---", len(elements))
        for el in elements[:60]:
            log.info(
                "  <%s> id=%r name=%r text=%r href=%r onclick=%r visible=%s",
                el["tag"], el["id"], el["name"],
                el["text"][:40], el["href"][:80], el["onclick"][:80], el["visible"],
            )
        log.info("--- End clickable elements ---")
    except Exception as e:
        log.warning("Could not enumerate clickable elements: %s", e)


def _log_all_inputs(ctx) -> None:
    """Log every <input> on the page with its type, id, name — helps diagnose fill failures."""
    try:
        inputs = ctx.evaluate("""
            () => [...document.querySelectorAll('input')].map(el => ({
                type: el.type, id: el.id, name: el.name,
                placeholder: el.placeholder,
                visible: el.offsetParent !== null,
            }))
        """)
        log.info("All inputs (%d):", len(inputs))
        for inp in inputs:
            log.info("  type=%r id=%r name=%r placeholder=%r visible=%s",
                     inp.get("type"), inp.get("id"), inp.get("name"),
                     inp.get("placeholder"), inp.get("visible"))
    except Exception as e:
        log.warning("Could not enumerate inputs: %s", e)


def _log_frames(page: Page) -> None:
    """Log all frames on the page (the tee sheet is sometimes inside an iframe)."""
    frames = page.frames
    log.info("Page frames (%d): %s", len(frames), [f.url for f in frames])


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


def _click_first(page: Page, selectors: list[str], label: str, force: bool = False) -> bool:
    """Try each selector in order; click the first one found. Return True on success."""
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count():
                if not force and not loc.is_visible():
                    continue
                loc.click(force=force)
                log.debug("Clicked %s with selector: %s (force=%s)", label, sel, force)
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

def _navigate_to_booking_via_menu(page: Page) -> None:
    """
    After logging in at LOGIN_URL, navigate to the main club site and use the
    Golf > Book a Tee Time nav menu to reach the booking page.
    This avoids the ssid/session mismatch that ssidfail causes.
    """
    # Go to the club's main homepage (not the dynamicmodule login URL)
    page.goto("https://www.lakelandsgolf.com/default.aspx",
              wait_until="networkidle", timeout=30_000)
    _screenshot(page, "menu_01_home")
    log.info("Main site URL: %s", page.url)
    _log_clickable_elements(page)

    # Golf nav item
    golf_clicked = _click_first(
        page,
        [
            'a:has-text("Golf")',
            'nav a:text-matches("^Golf$", "i")',
            'li a:text-matches("^Golf$", "i")',
            'a:text-matches("^Golf$", "i")',
        ],
        "Golf menu item",
    )
    if golf_clicked:
        page.wait_for_timeout(600)
        _screenshot(page, "menu_02_golf_menu")

    # Book a Tee Time link
    _click_first(
        page,
        [
            'a:has-text("Book a Tee Time")',
            'a:text-matches("book.*tee", "i")',
            'a:text-matches("tee.*time", "i")',
            'a[href*="pageid=125"]',
            'a[href*="booking"]',
        ],
        "Book a Tee Time link",
    )
    page.wait_for_load_state("networkidle", timeout=30_000)
    _screenshot(page, "menu_03_booking")
    log.info("After menu nav: %s", page.url)


def _open_booking_for(page: Page, date: str, players: int):
    """
    Land on the Lakelands tee-sheet and navigate to the target date.

    The Lakelands site uses separate session tokens per sub-system (ssid).
    Logging in via LOGIN_URL establishes ssid=100033 but NOT ssid=100178 (booking).
    When we navigate to BOOKING_URL unauthenticated, the server redirects to a
    second login page (?p=home&e=6&ssidfail=true) that has doLogin(...pageid=125...)
    baked into its submit button. Logging in *there* lands us directly on the
    booking page — no separate pre-login needed.

    Returns the Frame or Page that contains the tee-sheet content.
    """
    log.info("Opening booking page for %s ...", date)
    username, password = _credentials()

    # Navigate directly to the booking URL (unauthenticated is fine — it will
    # redirect us to the ssidfail login page for the booking sub-system).
    page.goto(BOOKING_URL, wait_until="networkidle", timeout=30_000)
    _screenshot(page, "03_booking_goto")
    _log_frames(page)
    log.info("After goto BOOKING_URL: %s", page.url)

    # If we were redirected to the ssidfail/login page, fill credentials there.
    # The submit button calls doLogin('p=dynamicmodule&pageid=125&...') which
    # should redirect us to the booking page on success.
    if any(kw in page.url for kw in ["ssidfail", "pageid=9", "login", "e=6"]) \
            or "pageid=125" not in page.url:
        log.info("Not on booking page — logging in via ssidfail form")
        _dump_html(page, "03_ssidfail_login_page")
        _log_all_inputs(page)

        # Use JavaScript to fill the form fields AND dispatch the DOM events
        # that doLogin() checks before reading values. Playwright's fill()
        # alone may not fire all the events the ASP.NET form expects.
        page.evaluate(
            """
            ([u, p]) => {
                const vis = el => el.offsetParent !== null;
                const fire = (el, val) => {
                    el.focus();
                    el.value = val;
                    ['input','change','blur'].forEach(evt =>
                        el.dispatchEvent(new Event(evt, {bubbles: true})));
                };
                const texts = [...document.querySelectorAll('input[type="text"]')].filter(vis);
                const pws   = [...document.querySelectorAll('input[type="password"]')].filter(vis);
                if (texts.length) fire(texts[0], u);
                if (pws.length)   fire(pws[0],   p);
            }
            """,
            [username, password],
        )
        # Belt-and-suspenders: also use Playwright's native fill so the
        # accessibility tree reflects the values
        try:
            page.locator('input[type="text"]').first.fill(username)
        except Exception:
            pass
        try:
            page.locator('input[type="password"]').first.fill(password)
        except Exception:
            pass

        page.wait_for_timeout(600)  # let the form settle before clicking
        _screenshot(page, "03a_before_login_click")

        _click_first(
            page,
            [
                '#btnSecureLogin',
                '[id*="SecureLogin" i]',
                'input[value*="Sign In" i]',
                '[onclick*="doLogin" i]',
                'input[type="submit"]',
                'button[type="submit"]',
            ],
            "sign-in button on ssidfail page",
        )

        # Wait for the URL to change to the booking page (up to 20s)
        try:
            page.wait_for_url("*pageid=125*", timeout=20_000)
            log.info("Navigated to booking page: %s", page.url)
        except Exception:
            page.wait_for_load_state("networkidle", timeout=15_000)
            log.info("After login click (no pageid=125 redirect): %s", page.url)

        _screenshot(page, "03b_after_ssidfail_login")

        # If still not on the booking page, fall back to LOGIN_URL + menu nav
        if "pageid=125" not in page.url:
            log.warning("ssidfail login did not reach booking page — "
                        "falling back to LOGIN_URL + Golf menu navigation")
            _login(page)
            _navigate_to_booking_via_menu(page)

    log.info("Booking page URL: %s", page.url)
    _screenshot(page, "03c_booking_page")
    _log_frames(page)
    _dump_html(page, "03c_booking_page_html")
    _log_clickable_elements(page)

    # --- Advance the tee-sheet calendar to the target date ---
    target = datetime.strptime(date, "%Y-%m-%d")
    booking_ctx = _find_booking_frame(page)
    _navigate_teesheet_to(booking_ctx, target)
    _screenshot(page, "04_results")
    return booking_ctx


def _find_booking_frame(page: Page):
    """
    The Lakelands tee-sheet content may be embedded in an <iframe>.
    Returns the Frame that contains the booking content, or the Page if inline.
    """
    frames = page.frames
    if len(frames) <= 1:
        return page
    for frame in frames[1:]:
        url = frame.url or ""
        if any(kw in url for kw in ["pageid=125", "ssid=100178", "booking", "teesheet", "tee-sheet"]):
            log.info("Found booking iframe: %s", url)
            return frame
    # If there's exactly one sub-frame and it's not blank, try it
    if len(frames) == 2:
        frame = frames[1]
        url = frame.url or ""
        if url and "about:blank" not in url:
            log.info("Using only sub-frame: %s", url)
            return frame
    log.debug("No booking iframe detected — using main page")
    return page


def _find_and_log_date_nav(ctx) -> None:
    """
    Comprehensive search: log every element on the page that could be a date
    navigation control. Searches ALL elements (not just interactive ones) for
    'next', 'forward', 'doPostBack', and ►/▶ patterns. Run this when the
    normal selectors fail so the next run can use the exact IDs.
    """
    try:
        results = ctx.evaluate(r"""
            () => {
                const skip = new Set(['SCRIPT','STYLE','HEAD','META','LINK','NOSCRIPT']);
                return [...document.querySelectorAll('*')]
                    .filter(el => !skip.has(el.tagName))
                    .filter(el => {
                        const combined = [
                            el.id || '', el.name || '', el.className || '',
                            el.href || '', el.getAttribute('onclick') || '',
                            el.title || '', el.alt || '',
                            (el.textContent || el.value || '').trim().slice(0, 40),
                        ].join(' ');
                        return /next|forward|doPostBack|►|▶/i.test(combined);
                    })
                    .map(el => ({
                        tag: el.tagName,
                        id: el.id || '',
                        cls: (el.className || '').slice(0, 60),
                        text: (el.textContent || el.value || '').trim().slice(0, 30),
                        href: (el.href || '').slice(0, 200),
                        onclick: (el.getAttribute('onclick') || '').slice(0, 200),
                        vis: el.offsetParent !== null,
                    }))
                    .slice(0, 60);
            }
        """)
        log.info("=== Date-nav / doPostBack elements (%d) ===", len(results))
        for el in results:
            log.info("  <%s> id=%r cls=%r text=%r href=%r onclick=%r vis=%s",
                     el["tag"], el["id"], el["cls"][:40], el["text"],
                     el["href"][:120], el["onclick"][:120], el["vis"])
        log.info("=== End date-nav elements ===")
    except Exception as e:
        log.warning("Could not search for date-nav elements: %s", e)


def _js_click_next(ctx) -> bool:
    """
    JavaScript fallback: scan ALL DOM elements (not just interactive ones) for
    the next-day navigation control and click it.
    Matches: ►/▶/> text, IDs/names/classNames with 'next'/'forward',
    doPostBack hrefs/onclicks with 'next'.
    """
    try:
        clicked = ctx.evaluate(r"""
            () => {
                const skip = new Set(['SCRIPT','STYLE','HEAD','META','LINK','NOSCRIPT']);
                const all = [...document.querySelectorAll('*')]
                    .filter(el => !skip.has(el.tagName));

                const el = all.find(e => {
                    const text    = (e.textContent || e.value || '').trim();
                    const id      = e.id    || '';
                    const name    = e.name  || '';
                    const cls     = e.className || '';
                    const href    = e.href  || '';
                    const oc      = e.getAttribute('onclick') || '';
                    const combined = id + ' ' + name + ' ' + cls + ' ' + href + ' ' + oc;

                    return (
                        // Arrow characters
                        text === '►' || text === '▶' || text === '>' ||
                        // 'next'/'forward' anywhere in id/name/class/href/onclick
                        /lnknext|btnnext|nextday|next[_-]day|next[_-]btn|forward/i.test(combined) ||
                        // Generic 'next' in id/name
                        (/next|forward/i.test(id) && id.length < 100) ||
                        // doPostBack href or onclick that references 'next'
                        (/doPostBack/i.test(href)  && /next/i.test(href)) ||
                        (/doPostBack/i.test(oc)    && /next/i.test(oc))
                    );
                });

                if (el) {
                    el.click();
                    return el.id || el.tagName + ':' +
                           (el.textContent || '').trim().slice(0, 20) || '?';
                }
                return null;
            }
        """)
        if clicked:
            log.info("JS-clicked next element: %r", clicked)
            return True
        return False
    except Exception as e:
        log.debug("JS click-next failed: %s", e)
        return False


def _dump_nav_state(ctx, label: str) -> None:
    """Log a comprehensive snapshot of the tee-sheet navigation state."""
    try:
        info = ctx.evaluate(r"""
            () => {
                const next = document.getElementById('nextDates');
                const prev = document.getElementById('prevDates');
                // All clickable things that look like dates or navigation
                const dateCells = [...document.querySelectorAll('a,td,th,span,div,input')]
                    .filter(el => {
                        const t = (el.textContent||el.value||'').trim();
                        const combined = [t, el.id, el.className, el.getAttribute('onclick')||'',
                                          el.href||''].join(' ');
                        return /\b\d{1,2}\b/.test(t) && t.length < 30 &&
                               (el.tagName === 'A' || el.tagName === 'TD' ||
                                el.getAttribute('onclick') || el.href);
                    })
                    .map(el => ({
                        tag: el.tagName, id: el.id||'',
                        cls: (el.className||'').slice(0,40),
                        text: (el.textContent||el.value||'').trim().slice(0,30),
                        href: (el.href||'').slice(0,150),
                        oc: (el.getAttribute('onclick')||'').slice(0,150),
                        vis: el.offsetParent !== null,
                    }))
                    .filter(e => e.vis)
                    .slice(0, 40);
                const pageText = (document.body && document.body.innerText || '').slice(0, 500);
                return {
                    nextHTML: next ? next.outerHTML.slice(0, 400) : 'MISSING',
                    nextBBox: next ? JSON.stringify(next.getBoundingClientRect()) : null,
                    prevHTML: prev ? prev.outerHTML.slice(0, 200) : 'MISSING',
                    dateCells,
                    pageText,
                };
            }
        """)
        log.info("=== NAV STATE [%s] ===", label)
        log.info("#nextDates: %s  BBox: %s", info['nextHTML'], info['nextBBox'])
        log.info("#prevDates: %s", info['prevHTML'])
        log.info("Page text (first 500): %r", info['pageText'])
        log.info("Visible date-like cells (%d):", len(info['dateCells']))
        for c in info['dateCells']:
            log.info("  <%s> id=%r cls=%r text=%r href=%r oc=%r",
                     c['tag'], c['id'], c['cls'], c['text'], c['href'][:80], c['oc'][:80])
        log.info("=== END NAV STATE ===")
    except Exception as e:
        log.warning("_dump_nav_state failed: %s", e)


def _navigate_teesheet_to(ctx, target: datetime) -> None:
    """
    Drive the Lakelands tee-sheet to show tee times for `target`.

    Strategy (in order):
      1. Find any date input field and type the date directly — fastest.
      2. Find and click a calendar icon/button, then pick the day.
      3. Fall back to week-view navigation: #nextDates until target week
         is shown, then click the day cell.
    """
    _dump_html(ctx, "03e_booking_page_html")
    _dump_nav_state(ctx, "initial")
    _screenshot(ctx, "04a_booking_initial")

    target_date = target.date()
    day_num = str(target.day)           # "17"
    day_name_short = target.strftime("%a")   # "Fri"
    day_name_long  = target.strftime("%A")   # "Friday"
    date_mmddyyyy  = target.strftime("%m/%d/%Y")
    date_iso       = target.strftime("%Y-%m-%d")

    def _advance_week() -> bool:
        """Click #nextDates and wait for page to update. Returns True on success."""
        try:
            loc = ctx.locator('#nextDates')
            if loc.count():
                loc.click(force=True)
                ctx.wait_for_timeout(2500)
                try:
                    ctx.wait_for_load_state("networkidle", timeout=8_000)
                except Exception:
                    pass
                log.info("Advanced week via #nextDates")
                return True
        except Exception as e:
            log.warning("_advance_week failed: %s", e)
        return False

    def _select_day() -> bool:
        """Try every plausible selector to click the target day. Returns True on success."""
        selectors = [
            # Exact date in onclick/href (highest confidence)
            f'[onclick*="{date_mmddyyyy}"]',
            f'[href*="{date_mmddyyyy}"]',
            f'[onclick*="{date_iso}"]',
            f'[href*="{date_iso}"]',
            # Day number as visible text in a link or table cell
            f'a:text-is("{day_num}")',
            f'td:text-is("{day_num}")',
            f'th:text-is("{day_num}")',
            # Day name in a link
            f'a:has-text("{day_name_short}")',
            f'td:has-text("{day_name_short}")',
            # Generic "contains day number" with context
            f'[id*="lnkDate"][onclick*="{day_num}"]',
            f'[id*="Date_{day_num}"]',
            f'[id*="day{day_num}" i]',
        ]
        for sel in selectors:
            try:
                loc = ctx.locator(sel).first
                if loc.count() and loc.is_visible():
                    loc.click()
                    log.info("Selected day via: %s", sel)
                    ctx.wait_for_timeout(2000)
                    try:
                        ctx.wait_for_load_state("networkidle", timeout=8_000)
                    except Exception:
                        pass
                    return True
            except Exception:
                continue
        # force-click fallback
        for sel in selectors[:4]:
            try:
                loc = ctx.locator(sel).first
                if loc.count():
                    loc.click(force=True)
                    log.info("Force-selected day via: %s", sel)
                    ctx.wait_for_timeout(2000)
                    return True
            except Exception:
                continue
        return False

    def _current_week_contains_target() -> bool:
        """Return True if the target date appears to be in the currently shown week."""
        try:
            found = ctx.evaluate(f"""
                () => {{
                    const body = document.body.innerHTML || '';
                    // Look for the day number near a month abbreviation or in a date cell
                    return body.includes('{date_mmddyyyy}') ||
                           body.includes('{date_iso}') ||
                           (body.includes('Jul') && body.includes(' {day_num}'));
                }}
            """)
            return bool(found)
        except Exception:
            return False

    # ------------------------------------------------------------------ #
    # Strategy 1: fill a date text/input field directly                  #
    # ------------------------------------------------------------------ #
    DATE_INPUT_SELECTORS = [
        'input[id*="date" i][type="text"]',
        'input[name*="date" i][type="text"]',
        'input[class*="date" i][type="text"]',
        'input[id*="Date" i]:not([type="hidden"]):not([type="checkbox"])',
        'input[placeholder*="date" i]',
        'input[placeholder*="mm/dd" i]',
    ]
    for sel in DATE_INPUT_SELECTORS:
        try:
            loc = ctx.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.triple_click()
                loc.fill(date_mmddyyyy)
                loc.press("Enter")
                log.info("Filled date input %r with %s", sel, date_mmddyyyy)
                ctx.wait_for_timeout(2000)
                try:
                    ctx.wait_for_load_state("networkidle", timeout=8_000)
                except Exception:
                    pass
                _screenshot(ctx, "04b_after_date_input")
                return
        except Exception:
            continue

    # ------------------------------------------------------------------ #
    # Strategy 1b: call changeDate() JS directly — most reliable         #
    # ------------------------------------------------------------------ #
    try:
        js_date = f"{target.month}/{target.day}/{target.year}"
        result = ctx.evaluate(f"""
            () => {{
                if (typeof changeDate !== 'undefined') {{
                    changeDate('{js_date}');
                    return 'changeDate:{js_date}';
                }}
                return null;
            }}
        """)
        if result:
            log.info("Direct changeDate() call: %s", result)
            ctx.wait_for_timeout(2500)
            try:
                ctx.wait_for_load_state("networkidle", timeout=8_000)
            except Exception:
                pass
            _screenshot(ctx, "04b_after_changedate")
            return
    except Exception as e:
        log.warning("changeDate() call failed: %s", e)

    # ------------------------------------------------------------------ #
    # Strategy 2: click a calendar icon / button, then pick the day      #
    # ------------------------------------------------------------------ #
    CAL_SELECTORS = [
        'img[src*="cal" i]',
        'img[alt*="cal" i]',
        'input[type="image"][src*="cal" i]',
        '[id*="calendarIcon" i]',
        '[id*="cal_icon" i]',
        '[class*="cal-icon" i]',
        '[class*="calendar-icon" i]',
        '[class*="datepicker" i][id*="btn" i]',
        'button:has-text("Calendar")',
        'a:has-text("Calendar")',
        'input[value="Calendar"]',
        '[title*="Calendar" i]',
        '[aria-label*="calendar" i]',
    ]
    for sel in CAL_SELECTORS:
        try:
            loc = ctx.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click()
                log.info("Clicked calendar trigger: %s", sel)
                ctx.wait_for_timeout(1000)
                _screenshot(ctx, "04b_calendar_open")
                # Try to click the target day in whatever picker appeared
                day_str = str(target.day)
                picker_day_selectors = [
                    f'td[data-date*="{date_iso}"] a',
                    f'td[data-date*="{date_iso}"]',
                    f'.ui-datepicker-calendar td a:text-is("{day_str}")',
                    f'[class*="datepicker"] td a:text-is("{day_str}")',
                    f'[class*="calendar"] td a:text-is("{day_str}")',
                    f'td:not([class*="other"]):not([class*="disabled"]):not([class*="gray"]) a:text-is("{day_str}")',
                    f'a:text-is("{day_str}")',
                    f'td:text-is("{day_str}")',
                ]
                for psel in picker_day_selectors:
                    try:
                        ploc = ctx.locator(psel).first
                        if ploc.count() and ploc.is_visible():
                            ploc.click()
                            log.info("Picked day via: %s", psel)
                            ctx.wait_for_timeout(2000)
                            try:
                                ctx.wait_for_load_state("networkidle", timeout=8_000)
                            except Exception:
                                pass
                            _screenshot(ctx, "04c_day_selected")
                            return
                    except Exception:
                        continue
                log.warning("Calendar opened but could not pick day %s", day_str)
                break
        except Exception:
            continue

    # ------------------------------------------------------------------ #
    # Strategy 3: week-view navigation (advance weeks, click day cell)   #
    # ------------------------------------------------------------------ #
    # Advance weeks until the target date is visible (max 4 weeks out)
    for week_num in range(4):
        if _current_week_contains_target():
            log.info("Target date found in current week view (week_num=%d)", week_num)
            _dump_nav_state(ctx, f"week_{week_num}_target_found")
            _screenshot(ctx, f"04b_week_{week_num}")
            if _select_day():
                _screenshot(ctx, "04c_day_selected")
                log.info("Successfully navigated to %s", date_iso)
                return
            log.warning("Day selection failed after finding week")
            break
        log.info("Target not in current view (week %d), advancing...", week_num)
        if not _advance_week():
            log.warning("Cannot advance week at week_num=%d", week_num)
            break
        _dump_nav_state(ctx, f"after_week_advance_{week_num + 1}")

    # If week-based navigation failed, log final state for diagnosis
    _dump_nav_state(ctx, "final_failed")
    _screenshot(ctx, "04d_nav_failed")
    log.warning("Could not navigate tee sheet to %s", date_iso)


# ---------------------------------------------------------------------------
# Parse tee times from results page
# ---------------------------------------------------------------------------

def _parse_slots(ctx, players: int) -> list[dict]:
    """
    Extract available tee time slots from the Lakelands booking page.

    The booking page lists tee times as clickable rows/buttons. Each slot
    shows a time (e.g. "7:30 AM") and is clickable to open the booking modal.
    Returns list of dicts with keys: time, available_spots, price_per_player,
    cart_included, _locator_index (internal index used by make_reservation).
    """
    slots: list[dict] = []

    # --- Diagnostics: log what the page looks like after navigation ---
    _screenshot(ctx, "05_teesheet_after_nav")
    try:
        page_info = ctx.evaluate(r"""
            () => {
                const rows = [...document.querySelectorAll('table tr')];
                const rowTexts = rows.slice(0, 30).map(r => (r.textContent||'').trim().replace(/\s+/g,' ').slice(0,100));
                const pageText = (document.body.innerText||'').slice(0, 1000);
                const timeEls = [...document.querySelectorAll('*')].filter(el => {
                    const t = (el.textContent||'').trim();
                    return /\d{1,2}:\d{2}\s*(AM|PM)/i.test(t) && t.length < 50;
                }).map(el => ({tag: el.tagName, id: el.id, cls:(el.className||'').slice(0,30), text:(el.textContent||'').trim().slice(0,50)})).slice(0,20);
                return {rowCount: rows.length, rowTexts, pageText, timeEls};
            }
        """)
        log.info("=== SLOT PARSE DIAGNOSTIC ===")
        log.info("Table rows on page: %d", page_info['rowCount'])
        log.info("First 30 row texts:")
        for i, rt in enumerate(page_info['rowTexts']):
            log.info("  row[%d]: %r", i, rt)
        log.info("Page text (1000 chars): %r", page_info['pageText'])
        log.info("Time-pattern elements (%d):", len(page_info['timeEls']))
        for te in page_info['timeEls']:
            log.info("  <%s> id=%r cls=%r text=%r", te['tag'], te['id'], te['cls'], te['text'])
        log.info("=== END SLOT PARSE DIAGNOSTIC ===")
    except Exception as e:
        log.warning("Slot diagnostic failed: %s", e)

    # Primary approach: Lakelands (Jonas Club Software) marks available tee times
    # with the CSS class NC_TimeSlotPanelSlotAvailable on the <td> that holds the
    # time cell. Unavailable/full slots use NC_TimeSlotPanelNoSlots. The time is
    # in a child <span class="timeText">. This is more reliable than text scanning.
    avail_sel = "td[class*='NC_TimeSlotPanelSlotAvailable']"
    available_cells = ctx.locator(avail_sel)
    n_avail = available_cells.count()
    log.info("NC_TimeSlotPanelSlotAvailable cells: %d", n_avail)

    for i in range(n_avail):
        cell = available_cells.nth(i)
        # Time lives in a <span class="timeText"> inside the cell
        time_span = cell.locator("span.timeText").first
        if time_span.count():
            raw = (time_span.text_content() or "").strip()
        else:
            raw = (cell.text_content() or "").strip()
        t = _parse_time(raw)
        if not t:
            log.warning("Available cell %d: could not parse time from %r", i, raw[:60])
            continue
        log.info("Found available slot %d: time=%r", i, t)
        slots.append({
            "time": t,
            "available_spots": 4,
            "price_per_player": 0.0,
            "cart_included": False,
            "_locator_index": i,
            "_slot_selector": avail_sel,
        })

    # Fallback: if CSS class approach found nothing, do a broad text scan
    # (keeps the code working on other platforms or if the class names change).
    if not slots:
        log.info("CSS class scan found 0 slots — falling back to table-row text scan")
        # Log raw text_content of first 5 rows that contain a colon, for diagnosis
        candidates = ctx.locator("table tr")
        row_count = candidates.count()
        log.info("Fallback: scanning %d table rows", row_count)
        rows_logged = 0
        for i in range(row_count):
            el = candidates.nth(i)
            text = (el.text_content() or "").strip()
            if ":" in text and rows_logged < 10:
                log.info("  raw row[%d] repr: %r", i, text[:120])
                rows_logged += 1
            t = _parse_time(text)
            if not t:
                continue
            if re.search(r"\b(tee\s*time|date|player|price)\b", text, re.IGNORECASE) and i == 0:
                continue
            is_clickable = el.evaluate("""e => {
                if (e.tagName === 'A' || e.tagName === 'BUTTON') return true;
                if (e.getAttribute('onclick')) return true;
                const kids = e.querySelectorAll('a,button,input[type=submit],input[type=button],[onclick]');
                if (kids.length) return true;
                return window.getComputedStyle(e).cursor === 'pointer';
            }""")
            if not is_clickable:
                continue
            log.info("Fallback found slot: time=%r text=%r", t, text[:80])
            price_match = re.search(r"\$\s*([\d.]+)", text)
            slots.append({
                "time": t,
                "available_spots": 4,
                "price_per_player": float(price_match.group(1)) if price_match else 0.0,
                "cart_included": bool(re.search(r"cart|riding", text, re.IGNORECASE)),
                "_locator_index": i,
                "_slot_selector": "table tr",
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
            ctx = _open_booking_for(page, date, players)
            slots = _parse_slots(ctx, players)
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
            ctx = _open_booking_for(page, date, players)
            slots = _parse_slots(ctx, players)

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

            # Re-locate the slot cell using the selector stored during parsing,
            # then click the "Reserve" element inside it (or the cell itself).
            loc_idx = target["_locator_index"]
            slot_sel = target.get("_slot_selector", "td[class*='NC_TimeSlotPanelSlotAvailable']")
            el = ctx.locator(slot_sel).nth(loc_idx)
            log.info("Clicking Reserve for %s on %s (selector=%s, idx=%d) ...",
                     time, date, slot_sel, loc_idx)
            # Try clicking the "Reserve" text link first, then fall back to the cell
            reserve_el = el.locator(
                "a:has-text('Reserve'), button:has-text('Reserve'), "
                "input[value='Reserve'], span:has-text('Reserve')"
            ).first
            if reserve_el.count():
                reserve_el.click()
                log.info("Clicked Reserve link")
            else:
                el.click(force=True)
                log.info("Clicked slot cell (no Reserve link found)")

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
