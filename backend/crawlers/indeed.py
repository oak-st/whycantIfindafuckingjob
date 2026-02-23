"""Indeed job crawler using Playwright."""
import asyncio
import random
import urllib.parse
from typing import Optional
from playwright.async_api import async_playwright, Page, BrowserContext
from config import HEADLESS

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


async def _delay(min_s: float = 1.0, max_s: float = 3.0):
    await asyncio.sleep(random.uniform(min_s, max_s))


class IndeedCrawler:
    async def crawl(self, keywords: list[str], location: str,
                    max_jobs: int = 50, cookies=None,
                    headless: bool | None = None) -> list[dict]:
        _headless = HEADLESS if headless is None else headless
        jobs: list[dict] = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=_headless,
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                user_agent=UA,
                viewport={"width": 1280, "height": 900},
                locale="en-US",
            )
            page = await context.new_page()

            # Apply stealth if available
            try:
                from playwright_stealth import stealth_async
                await stealth_async(page)
            except Exception:
                pass

            try:
                for keyword in keywords:
                    if len(jobs) >= max_jobs:
                        break
                    found = await self._search(page, context, keyword, location,
                                               max_jobs - len(jobs))
                    jobs.extend(found)
            except Exception as e:
                print(f"[Indeed] Crawler error: {e}")
            finally:
                await browser.close()

        return jobs

    async def _search(self, page: Page, context: BrowserContext,
                      keyword: str, location: str, limit: int) -> list[dict]:
        q = urllib.parse.quote_plus(keyword)
        loc = urllib.parse.quote_plus(location)
        url = f"https://www.indeed.com/jobs?q={q}&l={loc}&sort=date"
        await page.goto(url, wait_until="domcontentloaded")
        await _delay(2, 4)

        jobs: list[dict] = []
        seen: set[str] = set()
        page_num = 0

        while len(jobs) < limit and page_num < 5:
            await self._dismiss_popups(page)

            # Use the outer card container only — not a union that also returns
            # inner elements like the <a data-jk> link itself.
            cards = await page.query_selector_all('.job_seen_beacon')
            if not cards:
                cards = await page.query_selector_all('.tapItem')

            for card in cards:
                if len(jobs) >= limit:
                    break
                job = await self._extract_card(context, card, seen)
                if job:
                    jobs.append(job)
                    seen.add(job["url"])

            next_btn = await page.query_selector(
                '[aria-label="Next Page"], [data-testid="pagination-page-next"]'
            )
            if not next_btn:
                break
            try:
                await next_btn.click(timeout=5000)
                await _delay(2, 4)
                page_num += 1
            except Exception:
                break

        return jobs

    async def _dismiss_popups(self, page: Page):
        try:
            await page.keyboard.press("Escape")
            await _delay(0.3, 0.5)
        except Exception:
            pass
        for selector in [
            'button[id*="close"]',
            '[aria-label="close"]',
            'button:has-text("No thanks")',
            'button:has-text("Close")',
        ]:
            try:
                btn = await page.query_selector(selector)
                if btn:
                    await btn.click(timeout=1500)
                    break
            except Exception:
                pass

    async def _extract_card(self, context: BrowserContext,
                             card, seen: set) -> Optional[dict]:
        try:
            # The job key (jk) lives on the <a> inside the card, not on the card itself.
            link_el = await card.query_selector("a[data-jk]")
            jk = (await link_el.get_attribute("data-jk") or "").strip() if link_el else ""

            # Always prefer the canonical viewjob URL — the raw href may be a
            # sponsored redirect (/pagead/clk or /rc/clk) that gives a bad URL
            # after stripping the query string.
            if jk:
                url = f"https://www.indeed.com/viewjob?jk={jk}"
            else:
                # Fallback: try to build URL from the first job link href
                fb = await card.query_selector("h2.jobTitle a, [data-testid='job-title'] a")
                if not fb:
                    return None
                href = await fb.get_attribute("href") or ""
                if href.startswith("/"):
                    href = "https://www.indeed.com" + href
                url = href.split("?")[0]
                if not url:
                    return None

            if url in seen:
                return None

            title_el = await card.query_selector(
                "h2.jobTitle span[title], [data-testid='job-title'] span, h2 a span"
            )
            title = (await title_el.inner_text()).strip() if title_el else ""
            if not title:
                h2 = await card.query_selector("h2.jobTitle, [data-testid='job-title']")
                title = (await h2.inner_text()).strip() if h2 else ""

            company_el = await card.query_selector(
                "[data-testid='company-name'], .companyName, span.companyName"
            )
            company = (await company_el.inner_text()).strip() if company_el else ""

            loc_el = await card.query_selector(
                "[data-testid='text-location'], .companyLocation"
            )
            location = (await loc_el.inner_text()).strip() if loc_el else ""

            salary_el = await card.query_selector(
                "[data-testid='attribute_snippet_testid'], .salary-snippet-container, "
                "[class*='salary']"
            )
            salary = (await salary_el.inner_text()).strip() if salary_el else ""

            date_el = await card.query_selector(
                "[data-testid='job-age'], .date, [class*='posted']"
            )
            posted_date = (await date_el.inner_text()).strip() if date_el else ""

            return {
                "title": title,
                "company": company,
                "location": location,
                "salary": salary,
                "description": "",
                "url": url,
                "posted_date": posted_date,
            }
        except Exception as e:
            print(f"[Indeed] Card error: {e}")
            return None
