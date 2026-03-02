"""USAJobs.gov job crawler — federal IT/cyber roles via public API.

Registration (free): https://developer.usajobs.gov/
Required headers: Host, User-Agent (your email), Authorization-Key (your API key).
"""
import asyncio
import json
import urllib.parse
import urllib.request


class USAJobsCrawler:
    BASE_URL = "https://data.usajobs.gov/api/search"

    def __init__(self, email: str, api_key: str):
        self.email = email
        self.api_key = api_key

    async def crawl(self, keywords: list[str], max_jobs: int = 200) -> list[dict]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._crawl_sync, keywords, max_jobs)

    def _crawl_sync(self, keywords: list[str], max_jobs: int) -> list[dict]:
        results: list[dict] = []
        seen: set[str] = set()
        headers = {
            "Host": "data.usajobs.gov",
            "User-Agent": self.email,
            "Authorization-Key": self.api_key,
        }

        for kw in keywords:
            page = 1
            while len(results) < max_jobs:
                params = urllib.parse.urlencode({
                    "Keyword": kw,
                    "LocationName": "United States",
                    "ResultsPerPage": 25,
                    "Page": page,
                    "WhoMayApply": "public",
                })
                req = urllib.request.Request(
                    f"{self.BASE_URL}?{params}", headers=headers
                )
                try:
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        data = json.loads(resp.read())
                except Exception as e:
                    print(f"[USAJobs] Error for {kw!r} page {page}: {e}")
                    break

                items = (
                    data.get("SearchResult", {}).get("SearchResultItems") or []
                )
                if not items:
                    break

                for item in items:
                    d = item.get("MatchedObjectDescriptor", {})
                    job_url = d.get("PositionURI", "")
                    if not job_url or job_url in seen:
                        continue
                    seen.add(job_url)

                    title = d.get("PositionTitle", "")
                    org = d.get("OrganizationName") or d.get("DepartmentName", "")

                    locs = d.get("PositionLocation") or []
                    loc_name = locs[0].get("LocationName", "") if locs else ""
                    if "anywhere in the u.s" in loc_name.lower() or "remote" in loc_name.lower():
                        loc_name = "Remote"

                    salary_str = ""
                    remuneration = d.get("PositionRemuneration") or []
                    if remuneration:
                        rem = remuneration[0]
                        lo = rem.get("MinimumRange", "")
                        hi = rem.get("MaximumRange", "")
                        interval = rem.get("RateIntervalCode", "")
                        if lo and hi:
                            try:
                                salary_str = f"${int(float(lo)):,} – ${int(float(hi)):,} {interval}".strip()
                            except ValueError:
                                salary_str = f"${lo} – ${hi} {interval}".strip()

                    details = (d.get("UserArea") or {}).get("Details") or {}
                    desc = details.get("JobSummary") or d.get("QualificationSummary") or ""
                    posted = (d.get("PublicationStartDate") or "")[:10]

                    results.append({
                        "title": title,
                        "company": org,
                        "location": loc_name,
                        "salary": salary_str,
                        "description": desc,
                        "url": job_url,
                        "posted_date": posted,
                    })

                total_all = int(
                    data.get("SearchResult", {}).get("SearchResultCountAll") or 0
                )
                if page * 25 >= total_all or page >= 8:
                    break
                page += 1

        print(f"[USAJobs] Total found: {len(results)} jobs")
        return results[:max_jobs]
