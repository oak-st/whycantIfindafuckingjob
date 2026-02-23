"""
Diagnostic script — tests every crawler with a small job limit.

Usage:
    cd backend
    python test_crawlers.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

KEYWORDS = ["software engineer"]
LOCATION = "United States"
MAX_JOBS = 3


# ── Company (Greenhouse / Ashby / Lever / Workday / Netflix / Microsoft / Playwright) ──

async def test_company():
    print("\n" + "=" * 55)
    print("COMPANY PAGES (Greenhouse / Ashby / Lever / Workday / …)")
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

async def main():
    results: dict[str, bool] = {}
    results["company"] = await test_company()

    print("\n" + "=" * 55)
    print("SUMMARY")
    print("=" * 55)
    for name, ok in results.items():
        icon = "OK" if ok else "FAIL"
        print(f"  [{icon}]  {name}")
    print()
    print("  Glassdoor requires session cookies — test via the UI.")


if __name__ == "__main__":
    asyncio.run(main())
