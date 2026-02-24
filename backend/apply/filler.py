"""Semi-automatic ATS form filler using Playwright.

The browser opens visibly, fills all fields it can, then stays open
for the user to review and submit manually.
"""
import asyncio
import random
import re
from pathlib import Path

from playwright.async_api import async_playwright, Page


# ── Active fill session state ─────────────────────────────────────────────
# { job_id: { status, ats, message, close_event } }
_fill_states: dict[int, dict] = {}


def get_fill_state(job_id: int) -> dict | None:
    return _fill_states.get(job_id)


def release_fill(job_id: int):
    """Signal the browser to close (called when user marks as applied)."""
    state = _fill_states.get(job_id)
    if state and "close_event" in state:
        state["close_event"].set()


# ── ATS detection ─────────────────────────────────────────────────────────

def detect_ats(url: str) -> str:
    if "greenhouse.io" in url:
        return "greenhouse"
    if "lever.co" in url:
        return "lever"
    if "ashbyhq.com" in url or "jobs.ashby.io" in url:
        return "ashby"
    if "myworkdayjobs.com" in url:
        return "workday"
    if "smartrecruiters.com" in url:
        return "smartrecruiters"
    return "unknown"


# ── Entry point ───────────────────────────────────────────────────────────

async def start_fill(
    job_id: int,
    job_url: str,
    cover_letter: str,
    custom_answers: dict,
    personal_info: dict,
    resume_path: str | None,
):
    """Run the fill in the background. Updates _fill_states[job_id]."""
    ats = detect_ats(job_url)
    close_event = asyncio.Event()
    _fill_states[job_id] = {
        "status": "filling",
        "ats": ats,
        "message": "Opening browser...",
        "close_event": close_event,
    }

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled", "--start-maximized"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        try:
            _fill_states[job_id]["message"] = f"Filling {ats} form..."

            if ats == "greenhouse":
                await _fill_greenhouse(page, job_url, cover_letter, custom_answers, personal_info, resume_path)
            elif ats == "lever":
                await _fill_lever(page, job_url, cover_letter, custom_answers, personal_info, resume_path)
            elif ats == "ashby":
                await _fill_ashby(page, job_url, cover_letter, custom_answers, personal_info, resume_path)
            elif ats == "workday":
                await _fill_workday(page, job_url, cover_letter, custom_answers, personal_info, resume_path)
            else:
                await page.goto(job_url)
                _fill_states[job_id]["message"] = "Unknown ATS — please fill the form manually"

            _fill_states[job_id]["status"] = "filled"
            _fill_states[job_id]["message"] = "Form filled — review in the browser, then click Mark as Applied"

            # Keep browser open: wait for user to trigger close or 30-min timeout
            try:
                await asyncio.wait_for(close_event.wait(), timeout=1800)
            except asyncio.TimeoutError:
                pass

        except Exception as e:
            print(f"[AutoFill] Error for job {job_id}: {e}")
            import traceback; traceback.print_exc()
            _fill_states[job_id]["status"] = "error"
            _fill_states[job_id]["message"] = str(e)
        finally:
            try:
                await browser.close()
            except Exception:
                pass
            _fill_states.pop(job_id, None)


# ── Shared helpers ────────────────────────────────────────────────────────

async def _delay(min_s: float = 0.3, max_s: float = 0.8):
    await asyncio.sleep(random.uniform(min_s, max_s))


async def _try_fill(page: Page, selectors: list[str], value: str) -> bool:
    """Try multiple selectors, fill the first visible one."""
    if not value:
        return False
    for sel in selectors:
        try:
            el = page.locator(sel).first
            if await el.count() > 0 and await el.is_visible():
                await el.fill(value)
                await _delay()
                return True
        except Exception:
            continue
    return False


async def _try_upload(page: Page, selectors: list[str], file_path: str) -> bool:
    """Try to upload a file using multiple selectors."""
    if not file_path or not Path(file_path).exists():
        return False
    for sel in selectors:
        try:
            el = page.locator(sel).first
            if await el.count() > 0:
                await el.set_input_files(file_path)
                await _delay(1, 2)
                return True
        except Exception:
            continue
    return False


async def _fill_by_label(page: Page, label_text: str, value: str, fuzzy: bool = False) -> bool:
    """Find an input by its label text and fill it."""
    if not value:
        return False
    try:
        # Try exact label
        label = page.locator(f"label:has-text('{label_text}')").first
        if await label.count() == 0 and fuzzy:
            label = page.locator("label").filter(has_text=label_text[:15]).first

        if await label.count() > 0:
            for_attr = await label.get_attribute("for")
            if for_attr:
                el = page.locator(f"#{for_attr}").first
                if await el.count() > 0:
                    await el.fill(value)
                    await _delay()
                    return True
            # Try sibling input
            parent = label.locator("xpath=..")
            el = parent.locator("input:not([type='hidden']):not([type='checkbox']), textarea").first
            if await el.count() > 0:
                await el.fill(value)
                await _delay()
                return True
    except Exception:
        pass
    return False


def _fuzzy_match(text1: str, text2: str, threshold: float = 0.45) -> bool:
    t1 = set(re.findall(r'\w+', text1.lower()))
    t2 = set(re.findall(r'\w+', text2.lower()))
    if not t1 or not t2:
        return False
    overlap = len(t1 & t2)
    return overlap / min(len(t1), len(t2)) >= threshold


# ── Greenhouse ────────────────────────────────────────────────────────────

async def _fill_greenhouse(page: Page, job_url: str, cover_letter: str,
                            custom_answers: dict, info: dict, resume_path: str | None):
    apply_url = job_url.rstrip("/")
    if not apply_url.endswith("/apply"):
        apply_url += "/apply"

    await page.goto(apply_url, wait_until="domcontentloaded")
    await _delay(2, 3)

    # If redirected away or 404, try clicking Apply on the job page
    if "apply" not in page.url or "404" in await page.title():
        await page.goto(job_url, wait_until="domcontentloaded")
        await _delay(2, 3)
        btn = page.locator("a:has-text('Apply'), button:has-text('Apply')").first
        if await btn.count() > 0:
            await btn.click()
            await page.wait_for_load_state("domcontentloaded")
            await _delay(2, 3)

    await _try_fill(page, ["#first_name", "input[name='first_name']"], info.get("first_name", ""))
    await _try_fill(page, ["#last_name", "input[name='last_name']"], info.get("last_name", ""))
    await _try_fill(page, ["#email", "input[name='email']", "input[type='email']"], info.get("email", ""))
    await _try_fill(page, ["#phone", "input[name='phone']", "input[type='tel']"], info.get("phone", ""))

    if info.get("linkedin_url"):
        await _try_fill(page, [
            "input[id*='linkedin']", "input[placeholder*='LinkedIn']",
            "input[placeholder*='linkedin']",
        ], info["linkedin_url"])

    if info.get("city") and info.get("state"):
        await _try_fill(page, [
            "input[id*='location']", "input[placeholder*='city']", "input[placeholder*='City']",
        ], f"{info['city']}, {info['state']}")

    # Resume upload
    await _try_upload(page, [
        "input[type='file'][id*='resume']",
        "input[type='file'][name='resume']",
        "#resume",
    ], resume_path or "")

    # Cover letter textarea
    if cover_letter:
        await _try_fill(page, [
            "textarea[id*='cover']", "textarea[name*='cover']", "#cover_letter",
        ], cover_letter)

    # Work authorization — look for Yes/No radio or select
    if info.get("work_authorized"):
        auth_radios = page.locator("input[type='radio'][value*='Yes'], input[type='radio'][value*='yes']")
        if await auth_radios.count() > 0:
            await auth_radios.first.check()
            await _delay()

    # Custom questions
    await _fill_custom_questions(page, custom_answers, [
        ".field", "[class*='question']", "li.custom-question",
    ])


# ── Lever ─────────────────────────────────────────────────────────────────

async def _fill_lever(page: Page, job_url: str, cover_letter: str,
                       custom_answers: dict, info: dict, resume_path: str | None):
    apply_url = job_url.rstrip("/")
    if not apply_url.endswith("/apply"):
        apply_url += "/apply"

    await page.goto(apply_url, wait_until="domcontentloaded")
    await _delay(2, 3)

    full_name = f"{info.get('first_name', '')} {info.get('last_name', '')}".strip()
    await _try_fill(page, ["input[name='name']", "#name"], full_name)
    await _try_fill(page, ["input[name='email']", "#email", "input[type='email']"], info.get("email", ""))
    await _try_fill(page, ["input[name='phone']", "#phone", "input[type='tel']"], info.get("phone", ""))

    if info.get("linkedin_url"):
        await _try_fill(page, [
            "input[name='urls[LinkedIn]']",
            "input[placeholder*='LinkedIn']",
            "input[id*='linkedin']",
        ], info["linkedin_url"])

    await _try_upload(page, ["input[type='file']"], resume_path or "")

    if cover_letter:
        await _try_fill(page, [
            "textarea[name='comments']", "textarea[id*='comments']",
            "textarea[id*='cover']", "textarea",
        ], cover_letter)

    await _fill_custom_questions(page, custom_answers, [
        ".application-field", "[class*='application-field']",
    ])


# ── Ashby ─────────────────────────────────────────────────────────────────

async def _fill_ashby(page: Page, job_url: str, cover_letter: str,
                       custom_answers: dict, info: dict, resume_path: str | None):
    apply_url = job_url.rstrip("/")
    if not apply_url.endswith("/application"):
        apply_url += "/application"

    await page.goto(apply_url, wait_until="domcontentloaded")
    await _delay(3, 5)  # Ashby is React-based

    try:
        await page.wait_for_selector("input", timeout=10000)
    except Exception:
        pass

    await _fill_by_label(page, "First Name", info.get("first_name", ""))
    await _fill_by_label(page, "Last Name", info.get("last_name", ""))
    await _fill_by_label(page, "Email", info.get("email", ""))
    await _fill_by_label(page, "Phone", info.get("phone", ""))

    if info.get("linkedin_url"):
        await _fill_by_label(page, "LinkedIn", info["linkedin_url"])

    await _try_upload(page, ["input[type='file']"], resume_path or "")

    if cover_letter:
        await _try_fill(page, [
            "textarea[placeholder*='cover']", "textarea[placeholder*='Cover']",
            "textarea[placeholder*='letter']", "textarea",
        ], cover_letter)

    # Custom questions by fuzzy label match
    for question, answer in custom_answers.items():
        await _fill_by_label(page, question, str(answer), fuzzy=True)


# ── Workday ───────────────────────────────────────────────────────────────

async def _fill_workday(page: Page, job_url: str, cover_letter: str,
                         custom_answers: dict, info: dict, resume_path: str | None):
    await page.goto(job_url, wait_until="domcontentloaded")
    await _delay(3, 5)

    # Click Apply button
    btn = page.locator("a:has-text('Apply'), button:has-text('Apply')").first
    if await btn.count() > 0:
        await btn.click()
        await _delay(3, 5)

    # Prefer "Apply Manually" if offered
    manual = page.locator("button:has-text('Apply Manually'), a:has-text('Apply Manually')").first
    if await manual.count() > 0:
        await manual.click()
        await _delay(2, 3)

    await page.wait_for_load_state("networkidle")
    await _delay(2, 3)

    # Upload resume first — Workday often asks for it on page 1
    await _try_upload(page, ["input[type='file']"], resume_path or "")

    # Fill standard fields by label (Workday uses aria-label and label text)
    await _fill_by_label(page, "First Name", info.get("first_name", ""))
    await _fill_by_label(page, "Last Name", info.get("last_name", ""))
    await _fill_by_label(page, "Email Address", info.get("email", ""))
    await _fill_by_label(page, "Email", info.get("email", ""))
    await _fill_by_label(page, "Phone Number", info.get("phone", ""))
    await _fill_by_label(page, "Phone", info.get("phone", ""))

    if info.get("city"):
        await _fill_by_label(page, "City", info["city"])
    if info.get("state"):
        await _fill_by_label(page, "State", info["state"])

    # Workday is multi-step — we fill page 1 and leave the rest for the user


# ── Generic custom question filler ────────────────────────────────────────

async def _fill_custom_questions(page: Page, answers: dict, container_selectors: list[str]):
    """Try to match and fill custom application questions."""
    if not answers:
        return

    for container_sel in container_selectors:
        containers = page.locator(container_sel)
        count = await containers.count()
        for i in range(count):
            container = containers.nth(i)
            try:
                label_el = container.locator("label").first
                if await label_el.count() == 0:
                    continue
                label_text = (await label_el.inner_text()).strip()
                for question, answer in answers.items():
                    if _fuzzy_match(label_text, question):
                        text_el = container.locator("textarea, input[type='text']").first
                        if await text_el.count() > 0 and await text_el.is_visible():
                            await text_el.fill(str(answer))
                            await _delay()
                        break
            except Exception:
                continue
