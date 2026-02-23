"""Glassdoor job crawler using Playwright."""
import asyncio
import random
from typing import Optional
from playwright.async_api import async_playwright, Page, BrowserContext
from config import HEADLESS


async def _delay(min_s: float = 1.0, max_s: float = 3.5):
    await asyncio.sleep(random.uniform(min_s, max_s))


class GlassdoorCrawler:
    def __init__(self, email: str = "", password: str = ""):
        self.email = email
        self.password = password

    async def crawl(self, keywords: list[str], location: str, max_jobs: int = 50,
                    cookies: list[dict] | None = None,
                    headless: bool | None = None) -> list[dict]:
        _headless = HEADLESS if headless is None else headless
        jobs: list[dict] = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=_headless,
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            if cookies:
                await context.add_cookies(cookies)
            page = await context.new_page()

            try:
                if not cookies:
                    await self._login(page)
                else:
                    # Verify session is still valid
                    await page.goto("https://www.glassdoor.com/member/home/index.htm",
                                    wait_until="domcontentloaded")
                    await _delay(1, 2)
                    if "/login" in page.url or "/signin" in page.url:
                        raise RuntimeError("Session expired — reconnect in Settings.")
                for keyword in keywords:
                    if len(jobs) >= max_jobs:
                        break
                    found = await self._search_jobs(page, context, keyword, location, max_jobs - len(jobs))
                    jobs.extend(found)
            except Exception as e:
                print(f"[Glassdoor] Crawler error: {e}")
            finally:
                await browser.close()

        return jobs

    async def _login(self, page: Page):
        await page.goto("https://www.glassdoor.com/profile/login_input.htm", wait_until="domcontentloaded")
        await _delay(1, 2)

        # Handle cookie consent if present
        try:
            consent_btn = await page.wait_for_selector('[id*="onetrust-accept"], button:has-text("Accept")', timeout=3000)
            if consent_btn:
                await consent_btn.click()
                await _delay(0.5, 1)
        except Exception:
            pass

        email_field = await page.query_selector('input[name="username"], input[type="email"], #inlineUserEmail')
        if email_field:
            await email_field.fill(self.email)

        # Some flows show email first, then password on next step
        try:
            continue_btn = await page.wait_for_selector('button:has-text("Continue"), button[type="submit"]', timeout=3000)
            await continue_btn.click()
            await _delay(1, 2)
        except Exception:
            pass

        password_field = await page.query_selector('input[name="password"], input[type="password"]')
        if password_field:
            await password_field.fill(self.password)
            await _delay(0.3, 0.8)

        submit_btn = await page.query_selector('button[type="submit"], button:has-text("Sign In")')
        if submit_btn:
            await submit_btn.click()

        await page.wait_for_load_state("networkidle", timeout=15000)

        if "/login" in page.url or "/signin" in page.url:
            raise RuntimeError(
                "Glassdoor login failed. Try logging in manually in a browser first."
            )

    async def _search_jobs(
        self, page: Page, context: BrowserContext,
        keyword: str, location: str, limit: int
    ) -> list[dict]:
        import urllib.parse
        query = urllib.parse.quote_plus(keyword)
        loc = urllib.parse.quote_plus(location)
        url = f"https://www.glassdoor.com/Job/jobs.htm?sc.keyword={query}&locT=N&locId=1&locKeyword={loc}"
        await page.goto(url, wait_until="domcontentloaded")
        await _delay(2, 4)

        # Dismiss any modals
        await self._dismiss_modals(page)

        jobs: list[dict] = []
        seen_urls: set[str] = set()
        page_num = 0

        while len(jobs) < limit:
            await self._dismiss_modals(page)

            cards = await page.query_selector_all(
                '[data-test="jobListing"], .react-job-listing, '
                '[class*="jobListItem"], [class*="JobsList_jobListItem"], '
                'li[class*="JobCard"]'
            )
            if not cards:
                break  # No cards at all — stop to avoid infinite loop

            prev_count = len(jobs)
            for card in cards:
                if len(jobs) >= limit:
                    break
                job = await self._extract_card(page, context, card, seen_urls)
                if job:
                    jobs.append(job)
                    seen_urls.add(job["url"])

            # If no new jobs were extracted this pass, stop to avoid infinite loop
            if len(jobs) == prev_count:
                break

            # Pagination
            next_btn = await page.query_selector('[data-test="pagination-next"], button[aria-label="Next"]')
            if not next_btn or page_num >= 4:
                break
            try:
                await next_btn.click(timeout=5000)
            except Exception:
                break
            await _delay(2, 4)
            page_num += 1

        return jobs

    async def _dismiss_modals(self, page: Page):
        """Close any overlays that block interaction."""
        # Escape is the most reliable way to dismiss Glassdoor modals
        try:
            await page.keyboard.press("Escape")
            await _delay(0.3, 0.5)
        except Exception:
            pass

        # Also try clicking a close button if one is present
        for selector in [
            '[class*="modal_closeIcon"]',
            '[class*="closeButton"]',
            '[aria-label="Close"]',
            '[data-test="modal-close-btn"]',
            'dialog button',
        ]:
            try:
                btn = await page.query_selector(selector)
                if btn:
                    await btn.click(timeout=2000)
                    await _delay(0.3, 0.5)
                    break
            except Exception:
                pass

    async def _extract_card(
        self, page: Page, context: BrowserContext,
        card, seen_urls: set
    ) -> Optional[dict]:
        try:
            link_el = await card.query_selector(
                "a[data-test='job-title'], [class*='jobTitle'] a, [class*='JobCard_jobTitle'] a, a[class*='jobTitle']"
            )
            if not link_el:
                link_el = await card.query_selector("a")
            if not link_el:
                return None

            href = await link_el.get_attribute("href")
            if not href:
                return None
            if href.startswith("/"):
                href = "https://www.glassdoor.com" + href
            clean_url = href.split("?")[0]

            if clean_url in seen_urls:
                return None

            title_el = await card.query_selector(
                "[data-test='job-title'], [class*='JobCard_jobTitle'], [class*='jobTitle']"
            )
            title = (await title_el.inner_text()).strip() if title_el else ""

            company_el = await card.query_selector(
                "[data-test='employer-name'], [class*='EmployerProfile_compactEmployerName'], [class*='employerName'], [class*='companyName']"
            )
            company = (await company_el.inner_text()).strip() if company_el else ""

            location_el = await card.query_selector(
                "[data-test='emp-location'], [class*='JobCard_location'], [class*='location']"
            )
            location = (await location_el.inner_text()).strip() if location_el else ""

            salary_el = await card.query_selector(
                "[data-test='detailSalary'], [class*='JobCard_salaryEstimate'], [class*='salaryEstimate'], [class*='salary']"
            )
            salary = (await salary_el.inner_text()).strip() if salary_el else ""

            description, posted_date = await self._fetch_job_detail(context, clean_url)

            return {
                "title": title,
                "company": company,
                "location": location,
                "salary": salary,
                "description": description,
                "url": clean_url,
                "posted_date": posted_date,
            }
        except Exception as e:
            print(f"[Glassdoor] Card extraction error: {e}")
            return None

    async def _fetch_job_detail(self, context: BrowserContext, url: str) -> tuple[str, str]:
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await _delay(1, 2)

            # Dismiss modals in detail page
            try:
                close_btn = await page.query_selector('.modal_closeIcon, [aria-label="Close"]')
                if close_btn:
                    await close_btn.click()
                    await _delay(0.3, 0.7)
            except Exception:
                pass

            desc_el = await page.query_selector(
                '[class*="jobDescriptionContent"], [data-test="jobDescriptionText"], '
                '.desc, #JobDescriptionContainer'
            )
            description = (await desc_el.inner_text()).strip() if desc_el else ""

            date_el = await page.query_selector('[data-test="job-age"], [class*="jobAge"]')
            posted_date = (await date_el.inner_text()).strip() if date_el else ""

            return description, posted_date
        except Exception:
            return "", ""
        finally:
            await page.close()
