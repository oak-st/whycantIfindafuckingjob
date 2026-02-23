from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    location = Column(String, default="")
    salary = Column(String, default="")
    description = Column(Text, default="")
    url = Column(String, unique=True, nullable=False)
    source = Column(String, nullable=False)  # "linkedin" | "glassdoor"
    posted_date = Column(String, default="")
    status = Column(String, default="new")  # new | saved | skipped | applied
    crawled_at = Column(DateTime, default=datetime.utcnow)


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    applied_at = Column(DateTime, default=datetime.utcnow)
    cover_letter = Column(Text, default="")
    custom_answers = Column(JSON, default=dict)
    status = Column(String, default="pending")  # pending | submitted | error


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(Text, default="")
