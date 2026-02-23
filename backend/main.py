import asyncio
import json
import os
import re
import sys
from pathlib import Path
from typing import List, Optional

# Playwright needs ProactorEventLoop on Windows to spawn browser subprocesses
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import aiofiles
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from database import get_db, init_db
from models import Job, Application, Setting
from schemas import (
    JobOut, JobStatusUpdate, ApplicationOut,
    ApplyDraft, ApplySubmit, SettingsIn, SettingsOut, CrawlStatus,
)
from crypto import encrypt, decrypt
from config import UPLOADS_DIR

app = FastAPI(title="Job Hunter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Track crawl state
crawl_state = {"running": False, "message": "Idle", "jobs_found": 0, "log": [], "current_source": None, "total_sources": 0, "cancel_requested": False}

scheduler = AsyncIOScheduler()


def _reschedule(enabled: bool, interval_hours: int):
    if scheduler.get_job("auto_crawl"):
        scheduler.remove_job("auto_crawl")
    if enabled:
        scheduler.add_job(_async_crawl, "interval", hours=interval_hours, id="auto_crawl")


def _company_source(company: str) -> str:
    """Normalise a company name into a DB source key, e.g. 'Scale AI' → 'scale_ai'."""
    return re.sub(r'[^a-z0-9]+', '_', company.lower()).strip('_')


def _matches_keywords(title: str, keywords: list[str]) -> bool:
    """Return True if the title is a good match for any keyword phrase.

    Matching rules (by phrase length):
      - 1–2 words → all words must appear in the title
      - 3+ words  → a majority (ceil(n/2)) of words must appear
    This lets "Senior VMware Engineer" match "Senior IT Engineer" (Senior+Engineer = 2/3)
    while still rejecting pure noise like "Analytics & BI Engineer" (Engineer only = 1/3).
    """
    title_lower = title.lower()
    for phrase in keywords:
        words = [w.lower() for w in re.findall(r'\b\w+\b', phrase)]
        if not words:
            continue
        required = len(words) if len(words) <= 2 else (len(words) + 1) // 2
        matched = sum(
            1 for w in words
            if re.search(r'\b' + re.escape(w) + r'\b', title_lower)
        )
        if matched >= required:
            return True
    return False


def _filter_by_keywords(jobs: list[dict], keywords: list[str]) -> list[dict]:
    """Drop jobs whose title doesn't satisfy any keyword phrase."""
    if not keywords:
        return jobs
    return [j for j in jobs if _matches_keywords(j.get("title", ""), keywords)]


def _filter_by_excluded_keywords(jobs: list[dict], exclude_keywords: list[str]) -> list[dict]:
    """Drop jobs whose title contains any excluded keyword phrase (simple substring match)."""
    if not exclude_keywords:
        return jobs
    result = []
    for j in jobs:
        title_lower = j.get("title", "").lower()
        if not any(phrase.lower() in title_lower for phrase in exclude_keywords if phrase):
            result.append(j)
    return result


def _parse_salary_min(salary_str: str) -> Optional[int]:
    """Extract the lower-bound annual salary from an unstructured string. Returns None if unparseable."""
    if not salary_str:
        return None
    s = salary_str.lower()
    hourly = "/hr" in s or "per hour" in s or "/hour" in s
    # Strip currency symbols and commas
    s = re.sub(r"[$€£,]", "", s)
    # Find all numbers (including decimals and K suffix)
    nums = re.findall(r"[\d]+(?:\.\d+)?k?", s)
    if not nums:
        return None
    try:
        values = []
        for n in nums:
            if n.endswith("k"):
                values.append(float(n[:-1]) * 1000)
            else:
                values.append(float(n))
        annual = min(values)
        if hourly:
            annual = annual * 2080
        return int(annual)
    except (ValueError, TypeError):
        return None


@app.on_event("startup")
async def startup():
    init_db()
    scheduler.start()
    db = next(get_db())
    try:
        s = _load_settings(db)
        enabled = s.get("auto_crawl_enabled") == "true"
        interval = int(s.get("auto_crawl_interval_hours", "24"))
        _reschedule(enabled, interval)
    finally:
        db.close()


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown(wait=False)


# ── Jobs ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    counts = {}
    for status in ("new", "saved", "applied", "denied", "skipped"):
        counts[status] = db.query(Job).filter(Job.status == status).count()
    counts["total"] = db.query(Job).count()
    return counts


@app.get("/api/stats/sources")
def get_source_stats(db: Session = Depends(get_db)):
    from collections import defaultdict
    rows = db.query(Job.source, Job.status, Job.relevance_score).all()
    data = defaultdict(lambda: {"total": 0, "new": 0, "saved": 0, "applied": 0, "denied": 0, "scores": []})
    for source, status, score in rows:
        d = data[source]
        d["total"] += 1
        if status in ("new", "saved", "applied", "denied"):
            d[status] += 1
        if score is not None:
            d["scores"].append(score)
    result = []
    for source, d in data.items():
        scores = d.pop("scores")
        result.append({
            "source": source,
            "total": d["total"],
            "new": d["new"],
            "saved": d["saved"],
            "applied": d["applied"],
            "denied": d["denied"],
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        })
    return sorted(result, key=lambda r: r["avg_score"] or 0, reverse=True)


@app.get("/api/jobs", response_model=List[JobOut])
def list_jobs(
    status: Optional[str] = None,
    source: Optional[str] = None,
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Job)
    if status:
        q = q.filter(Job.status == status)
    if source:
        q = q.filter(Job.source == source)
    jobs = q.order_by(Job.crawled_at.desc()).all()
    if salary_min is not None or salary_max is not None:
        filtered = []
        for job in jobs:
            parsed = _parse_salary_min(job.salary)
            if parsed is None:
                filtered.append(job)  # no salary listed — always include
            else:
                if salary_min is not None and parsed < salary_min:
                    continue
                if salary_max is not None and parsed > salary_max:
                    continue
                filtered.append(job)
        return filtered
    return jobs


@app.patch("/api/jobs/{job_id}", response_model=JobOut)
def update_job_status(job_id: int, body: JobStatusUpdate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if body.status not in ("new", "saved", "skipped", "applied", "denied"):
        raise HTTPException(status_code=400, detail="Invalid status")
    job.status = body.status
    db.commit()
    db.refresh(job)
    return job


@app.post("/api/jobs/dismiss")
def dismiss_jobs(
    source: Optional[str] = None,
    status: Optional[str] = "new",
    db: Session = Depends(get_db),
):
    """Mark all matching jobs as skipped (soft dismiss from dashboard)."""
    q = db.query(Job)
    if status and status != "all":
        q = q.filter(Job.status == status)
    if source and source != "all":
        q = q.filter(Job.source == source)
    count = q.update({"status": "skipped"}, synchronize_session=False)
    db.commit()
    return {"dismissed": count}


# ── Crawl ─────────────────────────────────────────────────────────────────────

@app.get("/api/crawl/status", response_model=CrawlStatus)
def get_crawl_status():
    next_crawl_at = None
    job = scheduler.get_job("auto_crawl")
    if job and job.next_run_time:
        next_crawl_at = job.next_run_time.isoformat()
    return CrawlStatus(
        status="running" if crawl_state["running"] else "idle",
        message=crawl_state["message"],
        jobs_found=crawl_state["jobs_found"],
        next_crawl_at=next_crawl_at,
        current_source=crawl_state.get("current_source"),
        total_sources=crawl_state.get("total_sources", 0),
        log=crawl_state.get("log", []),
    )


@app.post("/api/crawl", response_model=CrawlStatus)
async def start_crawl(background_tasks: BackgroundTasks):
    if crawl_state["running"]:
        return CrawlStatus(status="running", message="Crawl already in progress", jobs_found=0)
    background_tasks.add_task(_async_crawl)
    return CrawlStatus(status="started", message="Crawl started", jobs_found=0)


@app.post("/api/crawl/stop")
def stop_crawl():
    if crawl_state["running"]:
        crawl_state["cancel_requested"] = True
        return {"message": "Stop requested"}
    return {"message": "No crawl running"}


async def _async_crawl():
    crawl_state["running"] = True
    crawl_state["jobs_found"] = 0
    crawl_state["log"] = []
    crawl_state["current_source"] = None
    crawl_state["cancel_requested"] = False

    db = next(get_db())
    try:
        settings = _load_settings(db)
        keywords = [k.strip() for k in settings.get("search_keywords", "IT Engineer").split(",") if k.strip()]
        exclude_keywords = [k.strip() for k in settings.get("exclude_keywords", "").split(",") if k.strip()]
        location = settings.get("search_location", "United States")
        salary_min = int(settings["salary_min"]) if settings.get("salary_min") else None
        salary_max = int(settings["salary_max"]) if settings.get("salary_max") else None
        max_jobs = int(settings.get("max_jobs", "50"))
        headless = settings.get("show_browser") != "true"  # show_browser=true → headless=False

        total = 0

        # FAANG + AI company career pages
        from crawlers.company import GREENHOUSE, ASHBY, LEVER, WORKDAY as _WORKDAY
        crawl_state["total_sources"] = len(GREENHOUSE) + len(ASHBY) + len(LEVER) + 1 + len(_WORKDAY) + 1 + 3
        crawl_state["message"] = "Crawling company career pages..."

        def _on_company_start(name: str):
            crawl_state["current_source"] = name
            crawl_state["message"] = f"Crawling {name}..."

        def _on_company_done(name: str, count: int, error: bool = False):
            crawl_state["log"].append({"source": name, "count": count, "error": error})
            crawl_state["current_source"] = None

        try:
            from crawlers.company import CompanyCrawler
            from collections import defaultdict
            crawler = CompanyCrawler()
            jobs = await crawler.crawl(
                keywords, location, max_jobs=max_jobs, headless=headless,
                on_start=_on_company_start, on_done=_on_company_done,
                should_stop=lambda: crawl_state.get("cancel_requested", False),
            )
            jobs = _filter_by_keywords(jobs, keywords)
            jobs = _filter_by_excluded_keywords(jobs, exclude_keywords)
            print(f"[Crawl] Companies after keyword filter: {len(jobs)} jobs")
            # Save each company under its own source key
            by_company: dict[str, list] = defaultdict(list)
            for job in jobs:
                by_company[_company_source(job.get("company", "direct"))].append(job)
            for src, company_jobs in by_company.items():
                n = _save_jobs(db, company_jobs, src, salary_min, salary_max)
                if n:
                    print(f"[Crawl]   {src}: saved {n}")
                total += n
            crawl_state["jobs_found"] = total
        except Exception as e:
            import traceback; traceback.print_exc()
            print(f"[Crawl] Company pages error: {e}")

        # AI relevance scoring for newly saved jobs
        api_key = decrypt(settings.get("anthropic_api_key_enc", ""))
        if api_key:
            resume_path = UPLOADS_DIR / settings.get("resume_filename", "")
            resume_text = resume_path.read_text(errors="ignore") if resume_path.exists() else ""
            await _score_new_jobs(db, api_key, keywords, resume_text)

        if crawl_state.get("cancel_requested"):
            crawl_state["message"] = f"Stopped — {total} new jobs saved"
        else:
            crawl_state["message"] = f"Done — {total} new jobs found"
    finally:
        crawl_state["running"] = False
        crawl_state["cancel_requested"] = False
        db.close()


async def _score_new_jobs(db: Session, api_key: str, keywords: list[str], resume_text: str):
    """Score all unscored jobs that have descriptions, with limited concurrency."""
    from ai.generator import score_job_relevance

    unscored = db.query(Job).filter(
        Job.relevance_score.is_(None),
        Job.description != "",
    ).all()

    if not unscored:
        return

    crawl_state["message"] = f"Scoring {len(unscored)} job matches..."
    print(f"[Score] Scoring {len(unscored)} unscored jobs...")

    sem = asyncio.Semaphore(3)

    async def _score_one(job):
        async with sem:
            try:
                score = await score_job_relevance(
                    api_key=api_key,
                    job_title=job.title,
                    job_description=job.description,
                    keywords=keywords,
                    resume_text=resume_text,
                )
                job.relevance_score = score
                print(f"[Score] {job.title}: {score}/10")
            except Exception as e:
                print(f"[Score] Failed for '{job.title}': {e}")

    await asyncio.gather(*[_score_one(j) for j in unscored])

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Score] Commit failed: {e}")


def _save_jobs(db: Session, jobs: list[dict], source: str,
               salary_min: Optional[int] = None, salary_max: Optional[int] = None) -> int:
    # Roll back any failed transaction from a previous save so the session is usable
    try:
        db.rollback()
    except Exception:
        pass

    saved = 0
    seen_this_batch: set[str] = set()  # dedupe within this list before hitting the DB

    for j in jobs:
        url = j.get("url", "").strip()
        if not url or url in seen_this_batch:
            continue
        if db.query(Job).filter(Job.url == url).first():
            continue
        if salary_min is not None or salary_max is not None:
            parsed = _parse_salary_min(j.get("salary", ""))
            if parsed is not None:
                if salary_min is not None and parsed < salary_min:
                    continue
                if salary_max is not None and parsed > salary_max:
                    continue
        seen_this_batch.add(url)
        db.add(Job(
            title=j.get("title", ""),
            company=j.get("company", ""),
            location=j.get("location", ""),
            salary=j.get("salary", ""),
            description=j.get("description", ""),
            url=url,
            source=source,
            posted_date=j.get("posted_date", ""),
        ))
        saved += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Save] Commit failed for {source}: {e}")
        saved = 0

    return saved


# ── Apply ─────────────────────────────────────────────────────────────────────

@app.post("/api/apply/{job_id}", response_model=ApplyDraft)
async def start_apply(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    settings = _load_settings(db)
    api_key = decrypt(settings.get("anthropic_api_key_enc", ""))

    resume_path = UPLOADS_DIR / settings.get("resume_filename", "")
    resume_text = ""
    if resume_path.exists():
        resume_text = resume_path.read_text(errors="ignore")

    cover_letter = ""
    if api_key:
        from ai.generator import generate_cover_letter
        cover_letter = await generate_cover_letter(
            api_key=api_key,
            job_title=job.title,
            company=job.company,
            job_description=job.description,
            resume_text=resume_text,
        )

    return ApplyDraft(job_id=job_id, cover_letter=cover_letter, custom_answers={})


@app.post("/api/apply/{job_id}/submit", response_model=ApplicationOut)
async def submit_apply(job_id: int, body: ApplySubmit, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    app_record = Application(
        job_id=job_id,
        cover_letter=body.cover_letter,
        custom_answers=body.custom_answers,
        status="submitted",
    )
    job.status = "applied"
    db.add(app_record)
    db.commit()
    db.refresh(app_record)
    return app_record


# ── Applications ──────────────────────────────────────────────────────────────

@app.get("/api/applications", response_model=List[ApplicationOut])
def list_applications(db: Session = Depends(get_db)):
    apps = db.query(Application).order_by(Application.applied_at.desc()).all()
    result = []
    for a in apps:
        job = db.query(Job).filter(Job.id == a.job_id).first()
        out = ApplicationOut.model_validate(a)
        out.job = JobOut.model_validate(job) if job else None
        result.append(out)
    return result


# ── Settings ──────────────────────────────────────────────────────────────────

def _load_settings(db: Session) -> dict:
    rows = db.query(Setting).all()
    return {r.key: r.value for r in rows}


def _set(db: Session, key: str, value: str):
    row = db.query(Setting).filter(Setting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))


@app.get("/api/settings", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    s = _load_settings(db)
    return SettingsOut(
        has_anthropic_api_key=bool(s.get("anthropic_api_key_enc")),
        search_keywords=s.get("search_keywords", "IT Engineer, Senior IT Engineer, IT Systems Engineer"),
        exclude_keywords=s.get("exclude_keywords", ""),
        search_location=s.get("search_location", "United States"),
        work_type=s.get("work_type", "any"),
        resume_filename=s.get("resume_filename", ""),
        salary_min=int(s["salary_min"]) if s.get("salary_min") else None,
        salary_max=int(s["salary_max"]) if s.get("salary_max") else None,
        max_jobs=int(s.get("max_jobs", "50")),
        auto_crawl_enabled=s.get("auto_crawl_enabled") == "true",
        auto_crawl_interval_hours=int(s.get("auto_crawl_interval_hours", "24")),
        show_browser=s.get("show_browser") == "true",
    )


@app.post("/api/settings", response_model=SettingsOut)
def save_settings(body: SettingsIn, db: Session = Depends(get_db)):
    if body.anthropic_api_key is not None:
        _set(db, "anthropic_api_key_enc", encrypt(body.anthropic_api_key))
    if body.search_keywords is not None:
        _set(db, "search_keywords", body.search_keywords)
    if body.exclude_keywords is not None:
        _set(db, "exclude_keywords", body.exclude_keywords)
    if body.search_location is not None:
        _set(db, "search_location", body.search_location)
    if body.work_type is not None:
        _set(db, "work_type", body.work_type)
    if body.salary_min is not None:
        _set(db, "salary_min", str(body.salary_min))
    if body.salary_max is not None:
        _set(db, "salary_max", str(body.salary_max))
    if body.max_jobs is not None:
        _set(db, "max_jobs", str(body.max_jobs))
    if body.auto_crawl_enabled is not None:
        _set(db, "auto_crawl_enabled", "true" if body.auto_crawl_enabled else "false")
    if body.auto_crawl_interval_hours is not None:
        _set(db, "auto_crawl_interval_hours", str(body.auto_crawl_interval_hours))
    if body.show_browser is not None:
        _set(db, "show_browser", "true" if body.show_browser else "false")
    db.commit()
    s = _load_settings(db)
    _reschedule(
        enabled=s.get("auto_crawl_enabled") == "true",
        interval_hours=int(s.get("auto_crawl_interval_hours", "24")),
    )
    return get_settings(db)


@app.post("/api/resume")
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    allowed = {".pdf", ".docx", ".txt"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, or TXT files accepted")

    dest = UPLOADS_DIR / file.filename
    async with aiofiles.open(dest, "wb") as f:
        content = await file.read()
        await f.write(content)

    _set(db, "resume_filename", file.filename)
    db.commit()
    return {"filename": file.filename}


# ── Serve frontend build ───────────────────────────────────────────────────────

frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        return FileResponse(str(frontend_dist / "index.html"))
