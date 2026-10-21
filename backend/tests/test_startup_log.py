"""Decision C (owner, 2026-10-19): masked startup DB target line (#40 D4).

Exactly one startup line names the resolved database target as scheme + host (+port)
only; the username, password, and database name never appear in captured output.
"""

import logging

from fastapi.testclient import TestClient

import app.main as main_module


def test_startup_logs_masked_db_target_once(tmp_path, monkeypatch, caplog) -> None:
    from app import models  # noqa: F401
    from app.database import Base
    from sqlalchemy import create_engine

    engine = create_engine(
        f"sqlite:///{tmp_path / 'masked.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:secret@db.example:5432/x")
    # Stub the engine so lifespan's create_all never dials the fake Postgres host.
    monkeypatch.setattr(main_module, "get_engine", lambda *args, **kwargs: engine)

    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        with TestClient(main_module.create_app()):
            pass

    db_lines = [
        record.getMessage()
        for record in caplog.records
        if "database target" in record.getMessage()
    ]
    assert len(db_lines) == 1
    assert db_lines[0].endswith("postgresql://db.example:5432")
    assert "user" not in db_lines[0]
    everything = "\n".join(record.getMessage() for record in caplog.records)
    assert "secret" not in everything
    assert ":5432/x" not in everything
