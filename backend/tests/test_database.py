"""Engine pool tests (issue #66).

Hermetic, zero DB I/O: engine construction is lazy, so the Postgres-branch
test asserts the pool pre-ping flag without ever connecting, and the
SQLite-branch test runs against a tmp_path file.
"""

from collections.abc import Mapping
from typing import Any

from sqlalchemy import text

from app import database


def test_postgres_engine_gets_pool_pre_ping(monkeypatch: Any) -> None:
    """Non-SQLite engines enable pool pre-ping so stale pooled connections
    (e.g. across a Neon auto-suspend wake) are re-established at checkout
    instead of surfacing a transient 500 on the first DB-touching request."""
    monkeypatch.setattr(database, "_engine_cache", {})
    engine = database.get_engine("postgresql://u:p@localhost:5432/db")
    assert engine.pool._pre_ping is True


def test_sqlite_engine_unchanged(monkeypatch: Any, tmp_path: Any) -> None:
    """SQLite branch keeps its behavior: no pre-ping, connect_args still
    carry check_same_thread=False, and construction + use still work."""
    monkeypatch.setattr(database, "_engine_cache", {})
    engine = database.get_engine(f"sqlite:///{tmp_path}/t.db")
    assert engine.pool._pre_ping is False
    kwargs = next(
        cell.cell_contents
        for cell in (engine.pool._creator.__closure__ or [])
        if isinstance(cell.cell_contents, Mapping)
    )
    assert kwargs["check_same_thread"] is False
    with engine.connect() as conn:
        assert conn.execute(text("select 1")).scalar() == 1
