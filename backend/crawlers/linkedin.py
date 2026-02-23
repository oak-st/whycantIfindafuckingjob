"""LinkedIn job crawler using Playwright."""
import asyncio
import random
from typing import Optional
from playwright.async_api import async_playwright, Page, BrowserContext
from config import HEADLESS


async def _delay(min_s: float = 1.0, max_s: float = 3.5):
    await asyncio.sleep(random.uniform(min_s, max_s))


class LinkedInCrawler:
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
                viewport={"width": 1280, "height": 800},
            )
            if cookies:
                await context.add_cookies(cookies)
            page = await context.new_page()

            try:
                if not cookies:
                    await self._login(page)
                else:
                    # Verify session is still valid
                    await page.goto("https://www.linkedin.com/feed/",
                                    wait_until="domcontentloaded")
                    await _delay(1, 2)
                    if "/login" in page.url or "/checkpoint/" in page.url:
                        raise RuntimeError("Session expired — reconnect in Settings.")
                for keyword in keywords:
                    if len(jobs) >= max_jobs:
                        break
                    found = await self._search_jobs(page, context, keyword, location, max_jobs - len(jobs))
                    jobs.extend(found)
            except Exception as e:
                print(f"[LinkedIn] Crawler error: {e}")
            finally:
                await browser.close()

        return jobs

    async def _login(self, page: Page):
        await page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
        await _delay(1, 2)

        await page.fill("#username", self.email)
        await _delay(0.5, 1)
        await page.fill("#password", self.password)
        await _delay(0.5, 1)
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle", timeout=15000)

        if "/checkpoint/" in page.url or "/login" in page.url:
            raise RuntimeError(
                "LinkedIn login failed or requires verification. "
                "Try logging in manually first, then re-run."
            )

    async def _search_jobs(
        self, page: Page, context: BrowserContext,
        keyword: str, location: str, limit: int
    ) -> list[dict]:
        import urllib.parse
        query = urllib.parse.quote_plus(keyword)
        loc = urllib.parse.quote_plus(location)
        url = f"https://www.linkedin.com/jobs/search/?keywords={query}&location={loc}&f_TPR=r604800"
        await page.goto(url, wait_until="domcontentloaded")
        await _delay(2, 4)

        jobs: list[dict] = []
        seen_urls: set[str] = set()
        page_num = 0

        while len(jobs) < limit:
            # Scroll down to load more cards
            for _ in range(5):
                await page.keyboard.press("End")
                await _delay(0.8, 1.5)

            cards = await page.query_selector_all(".jobs-search__results-list > li, .job-card-container")
            if not cards:
                # Try alternative selector
                cards = await page.query_selector_all("li.scaffold-layout__list-item")
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
            next_btn = await page.query_selector('button[aria-label="View next page"]')
            if not next_btn or page_num >= 4:
                break
            await next_btn.click()
            await _delay(2, 4)
            page_num += 1

        return jobs

    async def _extract_card(
        self, page: Page, context: BrowserContext,
        card, seen_urls: set
    ) -> Optional[dict]:
        try:
            link_el = await card.query_selector("a.job-card-list__title, a.job-card-container__link")
            if not link_el:
                return None
            href = await link_el.get_attribute("href")
            if not href:
                return None

            # Normalise URL
            if href.startswith("/"):
                href = "https://www.linkedin.com" + href
            # Strip query params after the job ID
            clean_url = href.split("?")[0].rstrip("/")

            if clean_url in seen_urls:
                return None

            title_el = await card.query_selector(".job-card-list__title, .job-card-container__link span")
            title = (await title_el.inner_text()).strip() if title_el else ""

            company_el = await card.query_selector(".job-card-container__primary-description, .artdeco-entity-lockup__subtitle")
            company = (await company_el.inner_text()).strip() if company_el else ""

            location_el = await card.query_selector(".job-card-container__metadata-item, .job-card-container__metadata-wrapper li")
            location = (await location_el.inner_text()).strip() if location_el else ""

            # Fetch full description in a new tab
            description, salary, posted_date = await self._fetch_job_detail(context, clean_url)

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
            print(f"[LinkedIn] Card extraction error: {e}")
            return None

    async def _fetch_job_detail(self, context: BrowserContext, url: str) -> tuple[str, str, str]:
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await _delay(1, 2)

            desc_el = await page.query_selector(".jobs-description__content, .job-view-layout")
            description = (await desc_el.inner_text()).strip() if desc_el else ""

            salary_el = await page.query_selector(".compensation__salary, .jobs-unified-top-card__job-insight span")
            salary = ""
            if salary_el:
                salary_text = (await salary_el.inner_text()).strip()
                if any(c in salary_text for c in ["$", "€", "£", "/yr", "/hr"]):
                    salary = salary_text

            date_el = await page.query_selector(".jobs-unified-top-card__posted-date, time")
            posted_date = ""
            if date_el:
                posted_date = (await date_el.inner_text()).strip()

            return description, salary, posted_date
        except Exception:
            return "", "", ""
        finally:
            await page.close()
