from collections.abc import Generator
from pathlib import Path
import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


default_database_path = Path(__file__).resolve().parents[1] / "data" / "cpdesk.db"
DATABASE_URL = os.getenv("CPDESK_DATABASE_URL", f"sqlite:///{default_database_path}")
if DATABASE_URL.startswith("sqlite:") and DATABASE_URL != "sqlite:///:memory:":
    db_path = DATABASE_URL.removeprefix("sqlite:///")
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
