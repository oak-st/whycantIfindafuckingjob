# Job Hunter

A self-hosted job aggregator and application tracker. Crawls company career pages and job boards for roles matching your keywords, scores them with Claude AI, and lets you generate cover letters and track applications — all from a local web UI.

---

## Features

- **Multi-source crawling** — Greenhouse, Ashby, Lever, Workday, SmartRecruiters, Netflix, Microsoft, Amazon, Google, Apple, Dice.com, and Glassdoor
- **Keyword + work-type filtering** — matches job titles against your search phrases and enforces remote/hybrid/onsite filtering
- **AI relevance scoring** — rates each job 1–10 against your keywords and resume using Claude
- **Cover letter generation** — generates tailored cover letters via the Claude API
- **Application tracking** — Dashboard, Applications, and Insights pages to manage your pipeline
- **Auto-crawl scheduling** — crawl on a configurable interval (6 / 12 / 24 / 48 hours)
- **Resume upload** — PDF/DOCX resume stored and used for scoring and generation

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, SQLite |
| Browser automation | Playwright (Chromium) |
| AI | Anthropic Claude API (`claude-haiku-4-5`) |
| Auth | JWT + bcrypt |

---

## Quick Start

### Option 1 — Docker (recommended)

```bash
# 1. Create a .env file at the repo root
cp .env.example .env   # or create manually (see Environment Variables below)

# 2. Build and run
docker compose up --build

# App available at http://localhost:8000
```

### Option 2 — Local dev

**Requirements:** Python 3.11+, Node 20+

```bash
# Backend
cd backend
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# App at http://localhost:5173, API at http://localhost:8000
```

**Windows shortcut:** double-click `start.bat` — opens both servers in separate terminal windows.

---

## Environment Variables

Create a `.env` file at the repo root:

```env
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_password

# Optional — auto-populated on first run
JWT_SECRET=
ENCRYPTION_KEY=
```

`JWT_SECRET` and `ENCRYPTION_KEY` are generated automatically on first launch if left blank. The Anthropic API key is entered through the Settings page in the UI and stored encrypted in the database.

---

## Settings

All configuration lives in the **Settings** page of the UI:

| Setting | Description |
|---|---|
| Search Keywords | Comma-separated job title phrases (e.g. `Senior DevOps Engineer, Cloud Engineer`) |
| Exclude Keywords | Title substrings to drop (e.g. `Principal, Director`) |
| Work Type | `Remote`, `Hybrid`, `Onsite`, or `Any` |
| Salary Min / Max | Annual salary filter (jobs with no salary data are always included) |
| Max Jobs | Cap per crawl run (25 / 50 / 100 / 200) |
| Auto-crawl | Enable and set interval |
| Resume | Upload PDF or DOCX — used for AI scoring and cover letter generation |
| Anthropic API Key | Required for relevance scoring and cover letter generation |
| Glassdoor credentials | Optional — enables Glassdoor crawling |

---

## Project Structure

```
job-hunter/
├── backend/
│   ├── main.py              # FastAPI app + crawl orchestration
│   ├── models.py            # SQLAlchemy models (Job, Application, Setting)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # JWT authentication
│   ├── config.py            # Env var loading
│   ├── crypto.py            # Encryption key management
│   ├── crawlers/
│   │   ├── company.py       # Greenhouse, Ashby, Lever, Workday, Netflix, Microsoft, Amazon, Google, Apple
│   │   ├── dice.py          # Dice.com (Playwright)
│   │   └── glassdoor.py     # Glassdoor (Playwright, requires login)
│   └── ai/
│       └── generator.py     # Claude API — relevance scoring + cover letter generation
├── frontend/
│   └── src/
│       ├── pages/           # Dashboard, Applications, Insights, Settings, Login
│       └── components/      # JobCard, ApplyModal, ViewModal
├── Dockerfile
├── docker-compose.yml
├── start.bat                # Windows dev launcher
└── start.sh                 # Unix dev launcher
```

---

## Crawl Sources

| Source | Method | Companies |
|---|---|---|
| Greenhouse | REST API | Anthropic, Cloudflare, Datadog, Stripe, Coinbase, Discord, and ~70 more |
| Ashby | REST API | OpenAI, Snowflake, 1Password, Wiz, and others |
| Lever | REST API | Mistral AI, Palantir |
| Workday | JSON API | Nvidia, CrowdStrike, Zoom, Salesforce, Palo Alto Networks, Cisco, and others |
| SmartRecruiters | REST API | ServiceNow |
| Netflix | Custom API | Netflix |
| Microsoft | gcsservices API | Microsoft |
| Amazon | Playwright | Amazon |
| Google | Playwright | Google |
| Apple | Playwright | Apple |
| Dice.com | Playwright | All companies on Dice |
| Glassdoor | Playwright (login) | All companies on Glassdoor |
