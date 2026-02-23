"""
Direct company career page crawler.
- Greenhouse & Lever APIs (no login needed)
- Netflix custom API (no login needed)
- Workday API for Nvidia, CrowdStrike (no login needed)
- Microsoft gcsservices JSON API (no login needed)
- Playwright for Amazon, Google, Apple (public APIs are locked)
- Meta: placeholder pending stable endpoint
"""
import asyncio
import json
import random
import re
import urllib.parse
import urllib.request

from playwright.async_api import async_playwright
from config import HEADLESS

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

# ── Confirmed working ATS tokens ──────────────────────────────────────────────

GREENHOUSE: dict[str, str] = {
    # AI / research
    "Anthropic":     "anthropic",
    "OpenAI":        "openai",
    "Scale AI":      "scaleai",
    "xAI":           "xai",
    "Databricks":    "databricks",
    # Infrastructure / cloud / security
    "Cloudflare":    "cloudflare",
    "Datadog":       "datadog",
    "Okta":          "okta",
    "Zscaler":       "zscaler",
    "Pure Storage":  "purestorage",
    "Rubrik":        "rubrik",
    "MongoDB":       "mongodb",
    "Elastic":       "elastic",
    "Twilio":        "twilio",
    "Snowflake":     "snowflake",
    "Zoom":          "zoom",
    "Figma":         "figma",
    # Fintech / crypto
    "Stripe":        "stripe",
    "Coinbase":      "coinbase",
    "Robinhood":     "robinhood",
    # Consumer / marketplace
    "Airbnb":        "airbnb",
    "Lyft":          "lyft",
    "DoorDash":      "doordash",
    "Reddit":        "reddit",
    # Gaming / entertainment
    "Riot Games":    "riotgames",
    "Epic Games":    "epicgames",
    "Bungie":        "bungie",
    "Roblox":        "roblox",
    # Communication / social
    "Discord":       "discord",
    # Sports betting / fintech
    "FanDuel":       "fanduel",
}

LEVER: dict[str, str] = {
    "Mistral AI": "mistral",
    "Palantir":   "palantir",
    # Netflix migrated off Lever — use NETFLIX_API instead
}

# Netflix uses a custom API (explore.jobs.netflix.net)
NETFLIX_API = "https://explore.jobs.netflix.net/api/apply/v2/jobs"

# Workday: (company_display_name, workday_subdomain, tenant, site_id)
WORKDAY: list[tuple[str, str, str, str]] = [
    ("Nvidia",      "nvidia.wd5",      "nvidia",      "NVIDIAExternalCareerSite"),
    ("CrowdStrike", "crowdstrike.wd5", "crowdstrike", "crowdstrikecareers"),
]


async def _delay(min_s=0.5, max_s=1.5):
    await asyncio.sleep(random.uniform(min_s, max_s))


def _get(url: str) -> dict | list:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


_US_TERMS = {"united states", "us", "usa", "remote", "anywhere", "worldwide"}
_US_STATES = {
    "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia",
    "ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj",
    "nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn","tx","ut","vt",
    "va","wa","wv","wi","wy","dc",
}


def _location_ok(loc: str) -> bool:
    if not loc:
        return True
    low = loc.lower()
    if any(t in low for t in _US_TERMS):
        return True
    tokens = {t.strip("(),").lower() for t in low.split()}
    return bool(tokens & _US_STATES)


def _strip_html(text: str) -> str:
    import html as _html
    if not text:
        return ""
    text = re.sub(
        r"</?(?:p|div|h[1-6]|li|br|tr|blockquote|section|article)[^>]*>",
        "\n", text, flags=re.IGNORECASE,
    )
    text = re.sub(r"<[^>]+>", "", text)
    text = _html.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"^\s+", "", text, flags=re.MULTILINE)
    return text.strip()


# ── Main crawler ──────────────────────────────────────────────────────────────

class CompanyCrawler:
    async def crawl(self, keywords: list[str], location: str,
                    max_jobs: int = 200, headless: bool | None = None,
                    on_start=None, on_done=None) -> list[dict]:
        jobs: list[dict] = []
        loop = asyncio.get_event_loop()

        # Greenhouse
        for name, token in GREENHOUSE.items():
            if on_start: on_start(name)
            try:
                found = await loop.run_in_executor(
                    None, self._greenhouse, name, token, keywords
                )
                jobs.extend(found)
                print(f"[Companies] {name}: {len(found)} jobs")
                if on_done: on_done(name, len(found))
                await _delay()
            except Exception as e:
                print(f"[Companies] {name} (greenhouse) error: {e}")
                if on_done: on_done(name, 0, error=True)

        # Lever
        for name, slug in LEVER.items():
            if on_start: on_start(name)
            try:
                found = await loop.run_in_executor(
                    None, self._lever, name, slug, keywords
                )
                jobs.extend(found)
                print(f"[Companies] {name}: {len(found)} jobs")
                if on_done: on_done(name, len(found))
                await _delay()
            except Exception as e:
                print(f"[Companies] {name} (lever) error: {e}")
                if on_done: on_done(name, 0, error=True)

        # Netflix (custom API)
        if on_start: on_start("Netflix")
        try:
            found = await loop.run_in_executor(None, self._netflix, keywords)
            jobs.extend(found)
            print(f"[Companies] Netflix: {len(found)} jobs")
            if on_done: on_done("Netflix", len(found))
        except Exception as e:
            print(f"[Companies] Netflix error: {e}")
            if on_done: on_done("Netflix", 0, error=True)

        # Workday companies
        for name, subdomain, tenant, site in WORKDAY:
            if on_start: on_start(name)
            try:
                found = await loop.run_in_executor(
                    None, self._workday, name, subdomain, tenant, site, keywords
                )
                jobs.extend(found)
                print(f"[Companies] {name}: {len(found)} jobs")
                if on_done: on_done(name, len(found))
                await _delay()
            except Exception as e:
                print(f"[Companies] {name} (workday) error: {e}")
                if on_done: on_done(name, 0, error=True)

        # Microsoft (gcsservices JSON API — no browser needed)
        if on_start: on_start("Microsoft")
        try:
            found = await loop.run_in_executor(None, self._microsoft_api, keywords)
            jobs.extend(found)
            print(f"[Companies] Microsoft: {len(found)} jobs")
            if on_done: on_done("Microsoft", len(found))
        except Exception as e:
            print(f"[Companies] Microsoft error: {e}")
            if on_done: on_done("Microsoft", 0, error=True)

        # Playwright-based scrapers (share one browser instance)
        try:
            found = await self._playwright_scrape(keywords, headless=headless,
                                                   on_start=on_start, on_done=on_done)
            for company, company_jobs in found.items():
                jobs.extend(company_jobs)
        except Exception as e:
            print(f"[Companies] Playwright scrape error: {e}")

        return jobs[:max_jobs]

    # ── Greenhouse ────────────────────────────────────────────────────────────

    def _greenhouse(self, company: str, token: str,
                    keywords: list[str]) -> list[dict]:
        url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
        data = _get(url)
        results = []
        for j in data.get("jobs", []):
            title = j.get("title", "")
            loc = j.get("location", {}).get("name", "")
            if not _location_ok(loc):
                continue
            results.append({
                "title": title,
                "company": company,
                "location": loc,
                "salary": "",
                "description": _strip_html(j.get("content", "")),
                "url": j.get("absolute_url", ""),
                "posted_date": (j.get("updated_at", "") or "")[:10],
            })
        return results

    # ── Lever ─────────────────────────────────────────────────────────────────

    def _lever(self, company: str, slug: str,
               keywords: list[str]) -> list[dict]:
        url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
        results = []
        for j in (data if isinstance(data, list) else []):
            title = j.get("text", "")
            cats = j.get("categories", {})
            loc = cats.get("location", "")
            if not loc and cats.get("allLocations"):
                loc = cats["allLocations"][0]
            if not _location_ok(loc):
                continue
            desc = _strip_html(
                j.get("description", "") + "\n" + j.get("additional", "")
            )
            results.append({
                "title": title,
                "company": company,
                "location": loc,
                "salary": "",
                "description": desc,
                "url": j.get("applyUrl", j.get("hostedUrl", "")),
                "posted_date": "",
            })
        return results

    # ── Playwright (Amazon, Google, Microsoft, Meta) ───────────────────────────

    async def _playwright_scrape(self, keywords: list[str],
                                  headless: bool | None = None,
                                  on_start=None, on_done=None) -> dict[str, list[dict]]:
        """Run all Playwright-based scrapers sharing a single browser."""
        _headless = HEADLESS if headless is None else headless
        results: dict[str, list[dict]] = {}

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=_headless,
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                user_agent=_HEADERS["User-Agent"],
                viewport={"width": 1280, "height": 900},
                locale="en-US",
            )
            try:
                for name, method in [
                    ("Amazon", self._amazon),
                    ("Apple",  self._apple),
                    ("Google", self._google),
                ]:
                    if on_start: on_start(name)
                    try:
                        found = await method(context, keywords)
                        results[name] = found
                        print(f"[Companies] {name}: {len(found)} jobs")
                        if on_done: on_done(name, len(found))
                    except Exception as e:
                        print(f"[Companies] {name} (playwright) error: {e}")
                        if on_done: on_done(name, 0, error=True)
                        results[name] = []
            finally:
                await browser.close()

        return results

    # ── Amazon ────────────────────────────────────────────────────────────────

    async def _amazon(self, context, keywords: list[str]) -> list[dict]:
        results: list[dict] = []
        seen: set[str] = set()
        page = await context.new_page()
        try:
            for kw in keywords:
                q = urllib.parse.quote_plus(kw)
                url = (f"https://www.amazon.jobs/en/search"
                       f"?base_query={q}&loc_query=United+States&sort=recent")
                await page.goto(url, wait_until="domcontentloaded")
                await _delay(2, 3)

                cards = await page.query_selector_all(
                    ".job-tile, [class*='job-tile'], [class*='job-list-item'], .job-result"
                )
                for card in cards:
                    try:
                        title_el = await card.query_selector(
                            "h3.job-title, [class*='job-title'], h3 a"
                        )
                        title = (await title_el.inner_text()).strip() if title_el else ""
                        link_el = await card.query_selector("a[href]")
                        href = (await link_el.get_attribute("href") or "") if link_el else ""
                        if href.startswith("/"):
                            href = "https://www.amazon.jobs" + href
                        if not href or href in seen:
                            continue
                        seen.add(href)
                        loc_el = await card.query_selector(
                            "[class*='location'], .location-icon-and-text"
                        )
                        loc = (await loc_el.inner_text()).strip() if loc_el else ""
                        if title:
                            results.append({"title": title, "company": "Amazon",
                                            "location": loc, "salary": "",
                                            "description": "", "url": href, "posted_date": ""})
                    except Exception:
                        pass
        finally:
            await page.close()
        return results

    # ── Google ────────────────────────────────────────────────────────────────

    async def _google(self, context, keywords: list[str]) -> list[dict]:
        """Scrape Google Careers. Job URLs embed the title as a slug."""
        results: list[dict] = []
        seen: set[str] = set()
        page = await context.new_page()
        try:
            for kw in keywords:
                q = urllib.parse.quote_plus(kw)
                url = (
                    "https://www.google.com/about/careers/applications/jobs/results"
                    f"?q={q}&location=United+States&sort_by=date"
                )
                await page.goto(url, wait_until="domcontentloaded")
                await _delay(4, 6)

                # Job links follow: /jobs/results/{16-18-digit-id}-{title-slug}
                job_urls = await page.evaluate("""() => {
                    const base = '/about/careers/applications/jobs/results/';
                    return [...new Set(
                        Array.from(document.querySelectorAll('a[href]'))
                            .map(a => a.href.split('?')[0])
                            .filter(h => h.includes(base) && /\\/\\d{10,}-/.test(h))
                    )];
                }""")

                for job_url in job_urls:
                    if job_url in seen:
                        continue
                    seen.add(job_url)
                    # Derive title from slug: "{id}-{word}-{word}-..." → "Word Word Word"
                    slug = job_url.rstrip("/").split("/")[-1]
                    parts = slug.split("-", 1)
                    title = (
                        parts[1].replace("-", " ").title()
                        if parts[0].isdigit() and len(parts) > 1
                        else slug.replace("-", " ").title()
                    )
                    results.append({
                        "title": title,
                        "company": "Google",
                        "location": "United States",
                        "salary": "",
                        "description": "",
                        "url": job_url,
                        "posted_date": "",
                    })
        finally:
            await page.close()
        return results

    # ── Microsoft (gcsservices JSON API) ──────────────────────────────────────

    def _microsoft_api(self, keywords: list[str]) -> list[dict]:
        results: list[dict] = []
        seen: set[str] = set()
        for kw in keywords:
            for pg in range(1, 6):  # up to 5 pages × 20 = 100 jobs per keyword
                params = urllib.parse.urlencode({
                    "q": kw,
                    "l": "en_us",
                    "pg": pg,
                    "pgSz": 20,
                    "o": "Recent",
                    "flt": "true",
                })
                url = (
                    "https://gcsservices.careers.microsoft.com"
                    f"/search/api/v1/search?{params}"
                )
                try:
                    data = _get(url)
                except Exception:
                    break
                jobs_data = (
                    data.get("operationResult", {})
                        .get("result", {})
                        .get("jobs", [])
                )
                if not jobs_data:
                    break
                for j in jobs_data:
                    job_id = j.get("jobId", "")
                    title = j.get("title", "")
                    props = j.get("properties", {})
                    loc = props.get("primaryLocation", "") or j.get("location", "")
                    if not _location_ok(loc):
                        continue
                    job_url = f"https://jobs.careers.microsoft.com/global/en/job/{job_id}/"
                    if not job_id or job_url in seen:
                        continue
                    seen.add(job_url)
                    results.append({
                        "title": title,
                        "company": "Microsoft",
                        "location": loc,
                        "salary": "",
                        "description": _strip_html(props.get("description", "")),
                        "url": job_url,
                        "posted_date": (j.get("postingDate", "") or "")[:10],
                    })
                if len(jobs_data) < 20:
                    break
        return results

    # ── Apple ─────────────────────────────────────────────────────────────────

    async def _apple(self, context, keywords: list[str]) -> list[dict]:
        results: list[dict] = []
        seen: set[str] = set()
        page = await context.new_page()
        try:
            for kw in keywords:
                q = urllib.parse.quote_plus(kw)
                url = (
                    f"https://jobs.apple.com/en-us/search"
                    f"?sort=relevance&search={q}&location=united-states-USA"
                )
                await page.goto(url, wait_until="domcontentloaded")
                await _delay(3, 5)

                rows = await page.query_selector_all(
                    "tbody tr, [class*='search-results'] li, [class*='table-row']"
                )
                for row in rows:
                    try:
                        link_el = await row.query_selector("a[href*='/en-us/details/']")
                        if not link_el:
                            continue
                        title = (await link_el.inner_text()).strip()
                        href = (await link_el.get_attribute("href") or "").split("?")[0]
                        if href.startswith("/"):
                            href = "https://jobs.apple.com" + href
                        if not href or href in seen:
                            continue
                        seen.add(href)
                        loc_el = await row.query_selector(
                            "[class*='table-col-2'], [class*='location'], "
                            "td:nth-child(2), [data-label='Locations']"
                        )
                        loc = (await loc_el.inner_text()).strip() if loc_el else ""
                        if not _location_ok(loc):
                            continue
                        if title:
                            results.append({
                                "title": title,
                                "company": "Apple",
                                "location": loc,
                                "salary": "",
                                "description": "",
                                "url": href,
                                "posted_date": "",
                            })
                    except Exception:
                        pass
        finally:
            await page.close()
        return results

    # ── Netflix ────────────────────────────────────────────────────────────────

    def _netflix(self, keywords: list[str]) -> list[dict]:
        results: list[dict] = []
        seen: set[str] = set()
        for kw in keywords:
            params = urllib.parse.urlencode({
                "domain": "netflix.com",
                "start": 0,
                "num": 100,
                "query": kw,
            })
            url = f"{NETFLIX_API}?{params}"
            try:
                data = _get(url)
            except Exception:
                continue
            for pos in data.get("positions", []):
                title = pos.get("name", "")
                job_url = pos.get("canonicalPositionUrl", "")
                if job_url in seen:
                    continue
                seen.add(job_url)
                locs = pos.get("locations", [])
                loc = ", ".join(locs) if isinstance(locs, list) else str(locs)
                if not _location_ok(loc):
                    continue
                results.append({
                    "title": title,
                    "company": "Netflix",
                    "location": loc,
                    "salary": "",
                    "description": _strip_html(pos.get("job_description", "")),
                    "url": job_url,
                    "posted_date": "",
                })
        return results

    # ── Workday (Nvidia, CrowdStrike, …) ──────────────────────────────────────

    def _workday(self, company: str, subdomain: str, tenant: str, site: str,
                 keywords: list[str], max_per_company: int = 200) -> list[dict]:
        results: list[dict] = []
        seen: set[str] = set()
        base = f"https://{subdomain}.myworkdayjobs.com"
        api_url = f"{base}/wday/cxs/{tenant}/{site}/jobs"
        for kw in keywords:
            offset = 0
            page = 0
            while page < 10:  # hard cap: 10 pages × 20 = 200 jobs per keyword
                body = json.dumps({
                    "appliedFacets": {},
                    "limit": 20,
                    "offset": offset,
                    "searchText": kw,
                }).encode()
                req = urllib.request.Request(
                    api_url, data=body,
                    headers={**_HEADERS, "Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        data = json.loads(resp.read())
                except Exception:
                    break
                postings = data.get("jobPostings", [])
                if not postings:
                    break
                for p in postings:
                    ext = p.get("externalPath", "")
                    job_url = f"{base}{ext}" if ext else ""
                    if not job_url or job_url in seen:
                        continue
                    seen.add(job_url)
                    loc = p.get("locationsText", "") or ""
                    if not _location_ok(loc):
                        continue
                    results.append({
                        "title": p.get("title", ""),
                        "company": company,
                        "location": loc,
                        "salary": "",
                        "description": "",
                        "url": job_url,
                        "posted_date": (p.get("postedOn", "") or "")[:10],
                    })
                if len(postings) < 20:
                    break
                offset += 20
                page += 1
            if len(results) >= max_per_company:
                break
        return results
