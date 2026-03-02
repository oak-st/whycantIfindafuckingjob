"""Dice.com job crawler — IT-focused job board (Playwright scraper)."""
import asyncio
import random
import re
import urllib.parse

from playwright.async_api import async_playwright
from config import HEADLESS


async def _delay(min_s: float = 2.0, max_s: float = 4.0):
    await asyncio.sleep(random.uniform(min_s, max_s))


class DiceCrawler:
    async def crawl(self, keywords: list[str], location: str = "United States",
                    max_jobs: int = 200, headless: bool | None = None,
                    remote_only: bool = False) -> list[dict]:
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
                    url = (
                        f"https://www.dice.com/jobs?q={q}"
                        f"&countryCode=US&language=en"
                    )
                    if remote_only:
                        url += "&filters.workplaceTypes=Remote"
                    try:
                        await page.goto(url, wait_until="load", timeout=30000)
                        try:
                            await page.wait_for_selector(
                                '[data-testid="job-card"]', timeout=10000
                            )
                        except Exception:
                            print(f"[Dice] kw={kw!r}: no cards appeared")
                            continue

                        cards = await page.query_selector_all('[data-testid="job-card"]')
                        print(f"[Dice] kw={kw!r}: {len(cards)} cards")

                        for card in cards:
                            try:
                                # Title from aria-label of main overlay link
                                link_el = await card.query_selector(
                                    'a[data-testid="job-search-job-card-link"]'
                                )
                                if not link_el:
                                    continue

                                aria = await link_el.get_attribute("aria-label") or ""
                                # "View Details for {title} ({guid})"
                                m = re.match(
                                    r"^View Details for (.+?) \([a-f0-9\-]+\)$", aria
                                )
                                title = m.group(1) if m else aria

                                href = (await link_el.get_attribute("href") or "").split("?")[0]
                                if not href or href in seen:
                                    continue
                                seen.add(href)

                                # Company from company-profile link's companyname param
                                company = ""
                                co_link = await card.query_selector(
                                    'a[href*="company-profile"]'
                                )
                                if co_link:
                                    co_href = await co_link.get_attribute("href") or ""
                                    m2 = re.search(r"companyname=([^&]+)", co_href)
                                    if m2:
                                        company = urllib.parse.unquote_plus(m2.group(1))

                                # Location from card inner text (appears after title)
                                card_text = await card.inner_text()
                                location_str = ""
                                if title and title in card_text:
                                    after_title = card_text[card_text.index(title) + len(title):]
                                    # Location is the first non-empty line after the title
                                    for line in after_title.splitlines():
                                        line = line.strip()
                                        if line and not line.startswith("Easy Apply") \
                                                and not line.startswith("Apply Now"):
                                            # Filter out emoji/icon lines
                                            if re.match(r'^[\w ,\.\-]+$', line):
                                                location_str = line
                                                break

                                # Description teaser from card text (last paragraph)
                                desc = ""
                                lines = [l.strip() for l in card_text.splitlines() if l.strip()]
                                if len(lines) > 4:
                                    desc = " ".join(lines[4:])[:500]

                                if title:
                                    results.append({
                                        "title": title,
                                        "company": company,
                                        "location": location_str,
                                        "salary": "",
                                        "description": desc,
                                        "url": href,
                                        "posted_date": "",
                                    })
                            except Exception:
                                pass

                        await _delay(2, 3)
                    except Exception as e:
                        print(f"[Dice] Error for keyword {kw!r}: {e}")
                        continue
            finally:
                await browser.close()

        print(f"[Dice] Total found: {len(results)} jobs")
        return results[:max_jobs]
