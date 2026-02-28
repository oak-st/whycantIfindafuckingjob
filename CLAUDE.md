# Claude Code Context

## Project

Self-hosted job aggregator. Python/FastAPI backend + React/Vite frontend. SQLite DB. Playwright for browser-based scrapers.

## Dev Setup

- Backend: `cd backend && uvicorn main:app --reload --port 8000`
- Frontend: `cd frontend && npm run dev` (port 5173)
- Windows shortcut: `start.bat`

## Key Files

- `backend/main.py` — FastAPI app, crawl orchestration (`_async_crawl`), all filter functions
- `backend/crawlers/company.py` — All company ATS crawlers (Greenhouse, Ashby, Lever, Workday, etc.)
- `backend/crawlers/dice.py` — Dice.com Playwright scraper
- `backend/crawlers/glassdoor.py` — Glassdoor Playwright scraper (requires login)
- `backend/ai/generator.py` — Claude API calls: relevance scoring + cover letter generation
- `backend/models.py` — SQLAlchemy ORM: `Job`, `Application`, `Setting`
- `backend/schemas.py` — Pydantic schemas; `SettingsIn.work_type` is `remote | hybrid | onsite | any`

## Crawl Pipeline (main.py `_async_crawl`)

1. Load settings (keywords, exclude_keywords, location, work_type, salary, max_jobs)
2. `CompanyCrawler.crawl()` → `_filter_by_keywords` → `_filter_by_excluded_keywords` → `_filter_by_work_type` → save
3. `DiceCrawler.crawl(remote_only=...)` → same filters → save
4. `GlassdoorCrawler.crawl()` (if credentials set) → save
5. `_score_new_jobs()` — Claude Haiku scores all unscored jobs with descriptions

## Filter Functions (main.py)

- `_matches_keywords(title, keywords)` — 1-2 word phrases: all words required; 3+ words: majority required
- `_filter_by_excluded_keywords(jobs, exclude_keywords)` — substring match on title
- `_filter_by_work_type(jobs, work_type)` — when `remote`, keeps only jobs with remote location terms or blank location
- `_location_ok(loc)` in company.py — US state/territory + "remote"/"anywhere" allowlist

## Company Crawler Notes

- `_location_ok()` is in `company.py`, used at source level during crawling
- `_filter_by_work_type()` is in `main.py`, applied post-crawl as a safety net
- Greenhouse/Ashby/Lever return full descriptions; Workday/Dice/Google/Amazon/Apple often don't
- Ashby has `isRemote` boolean field on job objects
- Workday `appliedFacets` could support remote filtering but varies per company

## AI (generator.py)

- Model: `claude-haiku-4-5-20251001`
- Relevance scoring: 1-10 score, max 3 concurrent (semaphore), 3 retries with backoff
- Cover letter: uses resume text + job description + user info from settings
- API key stored encrypted in DB, decrypted at runtime

## Auth

- JWT tokens, bcrypt passwords
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars (defaults: `admin` / empty)
- `JWT_SECRET` and `ENCRYPTION_KEY` auto-generated on first run if not set in `.env`

## Database

- SQLite at `job_hunter.db` (repo root, gitignored)
- `Job`: title, company, location, salary, description, url, source, status, relevance_score, crawled_at
- `Application`: job_id, cover_letter, custom_answers, status, applied_at
- `Setting`: key/value pairs (all settings stored here)

## Frontend

- React 18 + Tailwind CSS + React Router
- Pages: Dashboard, Applications, Insights, Settings, Login
- Dev port: 5173; in Docker/prod served as static files by FastAPI at port 8000
