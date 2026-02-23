from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Job, Application, Setting  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Safe migration: add columns introduced after initial schema
    from sqlalchemy import text, inspect
    inspector = inspect(engine)
    existing = {c["name"] for c in inspector.get_columns("jobs")}
    with engine.connect() as conn:
        if "relevance_score" not in existing:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN relevance_score INTEGER"))
            conn.commit()
