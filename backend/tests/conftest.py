"""Shared fixtures for the #40 API test suite.

Each test gets an isolated, file-based SQLite database in ``tmp_path``,
wired into the app via ``app.dependency_overrides[get_db]`` so
``create_app()`` stays no-arg (``test_health.py`` keeps working unchanged).
"""

import os
from urllib.parse import urlsplit

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _ensure_loopback_or_refuse(url: str) -> None:
    """Refuse non-loopback IT_DATABASE_URL targets unless explicitly opted in.

    Issue #45 review: a forgotten ``export IT_DATABASE_URL=<remote>`` would
    otherwise turn a plain ``pytest`` run into per-test ``drop_all`` on a real
    database. Raises ``pytest.UsageError`` so the run aborts cleanly before
    any fixture (and therefore any engine) is created.
    """
    host = urlsplit(url).hostname
    if host in _LOOPBACK_HOSTS or os.environ.get("IT_ALLOW_REMOTE") == "1":
        return
    raise pytest.UsageError(
        f"IT_DATABASE_URL points at non-loopback host '{host}': refusing to run "
        "the suite against a remote database (the test fixture would drop and "
        "recreate its schema). Point IT_DATABASE_URL at localhost / 127.0.0.1 / "
        "::1, or opt in explicitly with: export IT_ALLOW_REMOTE=1"
    )


if os.environ.get("IT_DATABASE_URL"):
    # Refuse at collection time, before any test or fixture runs.
    _ensure_loopback_or_refuse(os.environ["IT_DATABASE_URL"])


@pytest.fixture()
def test_db(tmp_path, monkeypatch):
    """Isolated file-based SQLite DB in tmp_path; returns (engine, session factory).

    Issue #45 (disclosed test tooling): with ``IT_DATABASE_URL`` set, the
    integration harness points the suite at a shared Postgres instead —
    schema is dropped and recreated per test; the SQLite default is unchanged.
    Non-loopback IT targets are refused unless ``IT_ALLOW_REMOTE=1``.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import models  # noqa: F401  (registers the mappings on Base.metadata)
    from app.database import Base

    if os.environ.get("IT_DATABASE_URL"):
        _ensure_loopback_or_refuse(os.environ["IT_DATABASE_URL"])
        from app.database import normalize_database_url

        engine = create_engine(normalize_database_url(os.environ["IT_DATABASE_URL"]))
        Base.metadata.drop_all(engine)
    else:
        db_path = tmp_path / "test.db"
        monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
        engine = create_engine(
            f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
        )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    return engine, factory


@pytest.fixture()
def client(test_db):
    """TestClient wired to the isolated DB via dependency_overrides[get_db]."""
    from app.database import get_db

    _, factory = test_db

    def override_get_db():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
