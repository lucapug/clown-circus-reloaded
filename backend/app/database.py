"""Database engine/session wiring (issue #40).

Engine construction from the resolved ``DATABASE_URL`` with scheme -> driver
normalization: plain ``postgresql://`` (as used by docker-compose and common
Neon/Render URLs) maps onto SQLAlchemy's psycopg-3 dialect. Engines are cached
per URL so env changes resolve to their own engine without re-import.
"""

from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import database_from_env


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def normalize_database_url(url: str) -> str:
    """Map plain postgres schemes onto the psycopg-3 SQLAlchemy dialect."""
    scheme = urlsplit_scheme(url)
    if scheme in ("postgres", "postgresql") and "postgresql+psycopg://" not in url:
        return url.replace(f"{scheme}://", "postgresql+psycopg://", 1)
    return url


def urlsplit_scheme(url: str) -> str:
    return url.split("://", 1)[0].lower()


_engine_cache: dict[str, Engine] = {}


def get_engine(url: str | None = None) -> Engine:
    """Return a (cached) engine for the resolved database URL."""
    resolved = url if url is not None else database_from_env()[0]
    target = normalize_database_url(resolved)
    if target not in _engine_cache:
        if target.startswith("sqlite"):
            _engine_cache[target] = create_engine(
                target, connect_args={"check_same_thread": False}
            )
        else:
            _engine_cache[target] = create_engine(
                target, connect_args={}, pool_pre_ping=True
            )
    return _engine_cache[target]


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one session per request, bound to the current engine."""
    factory = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    db = factory()
    try:
        yield db
    finally:
        db.close()
