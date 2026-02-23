"""
Diagnostic script — tests every crawler with a small job limit.

Usage:
    cd backend
    python test_crawlers.py [--indeed-debug]
"""
import asyncio
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

KEYWORDS = ["software engineer"]
LOCATION = "United States"
MAX_JOBS = 3


# ── Indeed ────────────────────────────────────────────────────────────────────

async def test_indeed():
    print("\n" + "=" * 55)
    print("INDEED")
    print("=" * 55)
    try:
        from crawlers.indeed import IndeedCrawler
        jobs = await IndeedCrawler().crawl(KEYWORDS, LOCATION, max_jobs=MAX_JOBS)
        _print_jobs(jobs)
        return len(jobs) > 0
    except Exception:
        import traceback; traceback.print_exc()
        return False


# ── Company (Greenhouse / Lever / Amazon) ─────────────────────────────────────

async def test_company():
    print("\n" + "=" * 55)
    print("COMPANY PAGES (Greenhouse / Lever / Amazon)")
    print("=" * 55)
    try:
        from crawlers.company import CompanyCrawler
        jobs = await CompanyCrawler().crawl(KEYWORDS, LOCATION, max_jobs=30)
        _print_jobs(jobs)
        return len(jobs) > 0
    except Exception:
        import traceback; traceback.print_exc()
        return False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _print_jobs(jobs: list):
    if not jobs:
        print("  No jobs returned.")
        return
    print(f"  Returned {len(jobs)} job(s):")
    for j in jobs[:5]:
        print(f"    · {j.get('title', '?')} @ {j.get('company', '?')}")
        print(f"      {j.get('location', '')}  {j.get('salary', '')}")
        print(f"      {j.get('url', '')}")


# ── Entry point ───────────────────────────────────────────────────────────────

async def indeed_dom_inspector():
    """Navigate to Indeed and print which selectors actually match."""
    print("\n" + "=" * 55)
    print("INDEED DOM INSPECTOR")
    print("=" * 55)
    from playwright.async_api import async_playwright
    from config import HEADLESS

    UA = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    q = urllib.parse.quote_plus(KEYWORDS[0])
    loc = urllib.parse.quote_plus(LOCATION)
    url = f"https://www.indeed.com/jobs?q={q}&l={loc}&sort=date"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=HEADLESS,
            args=["--disable-blink-features=AutomationControlled"],
        )
        ctx = await browser.new_context(user_agent=UA, viewport={"width": 1280, "height": 900}, locale="en-US")
        page = await ctx.new_page()

        print(f"  Navigating to: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(4)

        print(f"  Page title : {await page.title()}")
        print(f"  Final URL  : {page.url}")

        candidates = [
            "[data-jk]",
            ".job_seen_beacon",
            ".resultContent",
            ".tapItem",
            '[data-testid="job-title"]',
            'h2.jobTitle',
            '[data-testid="company-name"]',
            '.companyName',
            '[data-testid="text-location"]',
            'li[data-id]',
            'div[id^="job_"]',
        ]

        print("\n  Selector hits:")
        for sel in candidates:
            try:
                els = await page.query_selector_all(sel)
                tag = "HIT" if els else "   "
                print(f"  {tag} [{len(els):2d}]  {sel}")
            except Exception as e:
                print(f"  ERR        {sel}  ({e})")

        body_info = await page.evaluate("""() => ({
            title: document.title,
            jobLinks: Array.from(document.querySelectorAll('a[href]'))
                .filter(a => a.href.includes('viewjob') || a.href.includes('/rc/clk'))
                .slice(0, 3)
                .map(a => ({ text: a.textContent.trim().slice(0, 60), href: a.href.slice(0, 100) }))
        })""")
        print(f"\n  Job links sample: {body_info}")

        # Save full HTML
        html = await page.content()
        out_path = Path(__file__).parent / "indeed_debug.html"
        out_path.write_text(html, encoding="utf-8", errors="replace")
        print(f"\n  Full HTML saved to: {out_path} ({len(html):,} chars)")

        await browser.close()


async def main():
    indeed_debug = "--indeed-debug" in sys.argv

    if indeed_debug:
        await indeed_dom_inspector()
        return

    results: dict[str, bool] = {}
    results["indeed"]  = await test_indeed()
    results["company"] = await test_company()

    print("\n" + "=" * 55)
    print("SUMMARY")
    print("=" * 55)
    for name, ok in results.items():
        icon = "OK" if ok else "FAIL"
        print(f"  [{icon}]  {name}")
    print()
    print("  LinkedIn / Glassdoor require session cookies — test via the UI.")
    print("  Run with --indeed-debug to dump the Indeed DOM for selector inspection.")


if __name__ == "__main__":
    asyncio.run(main())
