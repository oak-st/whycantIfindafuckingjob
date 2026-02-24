"""Dice.com job crawler — IT-focused job board."""
import json
import urllib.parse
import urllib.request

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.dice.com",
    "Referer": "https://www.dice.com/",
}

_API = "https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search"


class DiceCrawler:
    def crawl(self, keywords: list[str], location: str = "United States",
              max_jobs: int = 200) -> list[dict]:
        results: list[dict] = []
        seen: set[str] = set()

        for kw in keywords:
            page_num = 1
            while len(results) < max_jobs:
                params = urllib.parse.urlencode({
                    "q": kw,
                    "countryCode2": "US",
                    "pageSize": 100,
                    "pageNumber": page_num,
                    "language": "en",
                })
                url = f"{_API}?{params}"
                try:
                    req = urllib.request.Request(url, headers=_HEADERS)
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        data = json.loads(resp.read())
                except Exception as e:
                    print(f"[Dice] API error (kw={kw!r} page={page_num}): {e}")
                    break

                jobs_data = data.get("data", [])
                if not jobs_data:
                    break

                for j in jobs_data:
                    job_id = j.get("id", "")
                    apply_url = j.get("applyUrl", "") or j.get("link", "")
                    if not apply_url:
                        apply_url = f"https://www.dice.com/job-detail/{job_id}" if job_id else ""
                    if not apply_url or apply_url in seen:
                        continue
                    seen.add(apply_url)

                    loc = j.get("location", "")
                    workplace = j.get("workplaceTypes", [])
                    if isinstance(workplace, list) and workplace:
                        loc = loc or workplace[0]

                    posted = (j.get("postedDate") or "")[:10]

                    results.append({
                        "title": j.get("jobTitle", ""),
                        "company": j.get("companyName", "Dice"),
                        "location": loc,
                        "salary": "",
                        "description": j.get("descriptionTeaser", ""),
                        "url": apply_url,
                        "posted_date": posted,
                    })

                meta = data.get("meta", {})
                total_results = meta.get("totalResults", 0)
                if page_num * 100 >= total_results:
                    break
                page_num += 1

        return results[:max_jobs]
