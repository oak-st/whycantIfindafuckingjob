from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class JobOut(BaseModel):
    id: int
    title: str
    company: str
    location: str
    salary: str
    description: str
    url: str
    source: str
    posted_date: str
    status: str
    crawled_at: datetime
    relevance_score: Optional[int] = None

    model_config = {"from_attributes": True}


class JobStatusUpdate(BaseModel):
    status: str  # new | saved | skipped | applied


class ApplicationOut(BaseModel):
    id: int
    job_id: int
    applied_at: datetime
    cover_letter: str
    custom_answers: dict
    status: str
    job: Optional[JobOut] = None

    model_config = {"from_attributes": True}


class ApplyDraft(BaseModel):
    job_id: int
    cover_letter: str
    custom_answers: dict


class ApplySubmit(BaseModel):
    cover_letter: str
    custom_answers: dict


class SettingsIn(BaseModel):
    anthropic_api_key: Optional[str] = None
    search_keywords: Optional[str] = None  # comma-separated
    exclude_keywords: Optional[str] = None  # comma-separated title exclusions
    search_location: Optional[str] = None
    work_type: Optional[str] = None  # remote | hybrid | onsite | any
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    max_jobs: Optional[int] = None  # 25 | 50 | 100 | 200
    auto_crawl_enabled: Optional[bool] = None
    auto_crawl_interval_hours: Optional[int] = None  # 6 | 12 | 24 | 48
    show_browser: Optional[bool] = None
    # Personal info for auto-fill
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    work_authorized: Optional[bool] = None
    # Glassdoor credentials
    glassdoor_email: Optional[str] = None
    glassdoor_password: Optional[str] = None


class SettingsOut(BaseModel):
    has_anthropic_api_key: bool
    search_keywords: str
    exclude_keywords: str = ""
    search_location: str
    work_type: str
    resume_filename: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    max_jobs: int = 50
    auto_crawl_enabled: bool = False
    auto_crawl_interval_hours: int = 24
    show_browser: bool = False
    # Personal info for auto-fill
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""
    linkedin_url: str = ""
    city: str = ""
    state: str = ""
    work_authorized: bool = True
    # Glassdoor
    has_glassdoor_credentials: bool = False


class CrawlLogEntry(BaseModel):
    source: str
    count: int
    error: bool = False


class CrawlStatus(BaseModel):
    status: str
    message: str
    jobs_found: int = 0
    next_crawl_at: Optional[str] = None
    current_source: Optional[str] = None
    total_sources: int = 0
    log: list[CrawlLogEntry] = []
