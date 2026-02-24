"""Dice.com job crawler — IT-focused job board (Playwright scraper)."""
import asyncio
import random
import re
import urllib.parse

from playwright.async_api import async_playwright
from config import HEADLESS


async def _delay(min_s: float = 1.5, max_s: float = 3.0):
    await asyncio.sleep(random.uniform(min_s, max_s))


def _strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class DiceCrawler:
    async def crawl(self, keywords: list[str], location: str = "United States",
                    max_jobs: int = 200, headless: bool | None = None) -> list[dict]:
        _headless = HEADLESS if headless is None else headless
        results: list[dict] = []
        seen: set[str] = set()

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=_headless,
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
                locale="en-US",
            )
            page = await context.new_page()

            try:
                for kw in keywords:
                    if len(results) >= max_jobs:
                        break
                    q = urllib.parse.quote_plus(kw)
                    url = f"https://www.dice.com/jobs?q={q}&countryCode=US&location=United+States&locationPrecision=Country&language=en"
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        await _delay(3, 5)

                        # Wait for job cards to load
                        try:
                            await page.wait_for_selector(
                                "dhi-search-cards-widget, .card-title-link, [data-cy='search-result-list']",
                                timeout=10000,
                            )
                        except Exception:
                            pass

                        # Extract job cards
                        cards = await page.query_selector_all(
                            "div[data-cy='search-result-list'] > *, "
                            ".search-card, dhi-search-card, "
                            "[data-testid='job-card']"
                        )

                        if not cards:
                            # Try alternate selectors
                            cards = await page.query_selector_all(
                                "a.card-title-link, "
                                "[class*='job-card'], "
                                "article[class*='card']"
                            )

                        for card in cards:
                            try:
                                # Title + link
                                link_el = await card.query_selector(
                                    "a.card-title-link, a[data-cy='card-title-link'], "
                                    "h5 a, h2 a, [class*='title'] a"
                                )
                                if not link_el:
                                    link_el = await card.query_selector("a[href]")
                                if not link_el:
                                    continue

                                title = (await link_el.inner_text()).strip()
                                href = (await link_el.get_attribute("href") or "").strip()
                                if not href:
                                    continue
                                if href.startswith("/"):
                                    href = "https://www.dice.com" + href
                                if href in seen:
                                    continue
                                seen.add(href)

                                # Company
                                co_el = await card.query_selector(
                                    "[data-cy='search-result-company-name'], "
                                    ".company-name, [class*='company']"
                                )
                                company = (await co_el.inner_text()).strip() if co_el else "Dice"

                                # Location
                                loc_el = await card.query_selector(
                                    "[data-cy='search-result-location'], "
                                    ".location, [class*='location']"
                                )
                                location_str = (await loc_el.inner_text()).strip() if loc_el else ""

                                if title:
                                    results.append({
                                        "title": title,
                                        "company": company,
                                        "location": location_str,
                                        "salary": "",
                                        "description": "",
                                        "url": href,
                                        "posted_date": "",
                                    })
                            except Exception:
                                pass

                        await _delay(2, 4)
                    except Exception as e:
                        print(f"[Dice] Error for keyword {kw!r}: {e}")
                        continue
            finally:
                await browser.close()

        return results[:max_jobs]
