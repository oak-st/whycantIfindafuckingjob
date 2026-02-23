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
    search_location: Optional[str] = None
    work_type: Optional[str] = None  # remote | hybrid | onsite | any
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    max_jobs: Optional[int] = None  # 25 | 50 | 100 | 200
    auto_crawl_enabled: Optional[bool] = None
    auto_crawl_interval_hours: Optional[int] = None  # 6 | 12 | 24 | 48
    show_browser: Optional[bool] = None


class SettingsOut(BaseModel):
    has_anthropic_api_key: bool
    search_keywords: str
    search_location: str
    work_type: str
    resume_filename: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    max_jobs: int = 50
    auto_crawl_enabled: bool = False
    auto_crawl_interval_hours: int = 24
    show_browser: bool = False


class CrawlStatus(BaseModel):
    status: str
    message: str
    jobs_found: int = 0
    next_crawl_at: Optional[str] = None
