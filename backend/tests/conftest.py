"""Shared fixtures for the #40 API test suite.

Each test gets an isolated, file-based SQLite database in ``tmp_path``,
wired into the app via ``app.dependency_overrides[get_db]`` so
``create_app()`` stays no-arg (``test_health.py`` keeps working unchanged).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def test_db(tmp_path, monkeypatch):
    """Isolated file-based SQLite DB in tmp_path; returns (engine, session factory)."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import models  # noqa: F401  (registers the mappings on Base.metadata)
    from app.database import Base

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
