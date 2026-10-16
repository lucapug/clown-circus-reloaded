"""DATABASE_URL resolver tests (issue #3)."""

import pytest

from app.config import DEFAULT_DATABASE_URL, database_from_env, resolve_database


def test_unset_database_url_defaults_to_sqlite() -> None:
    url, backend = resolve_database(None)
    assert url == "sqlite:///./clowncircus.db"
    assert url == DEFAULT_DATABASE_URL
    assert backend == "sqlite"


def test_empty_database_url_defaults_to_sqlite() -> None:
    url, backend = resolve_database("")
    assert url == DEFAULT_DATABASE_URL
    assert backend == "sqlite"


def test_postgres_url_used_verbatim() -> None:
    raw = "postgresql://clown:clown@db:5432/clowncircus"
    url, backend = resolve_database(raw)
    assert url == raw
    assert backend == "postgres"


def test_database_from_env_unset_defaults_to_sqlite(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    url, backend = database_from_env()
    assert url == DEFAULT_DATABASE_URL
    assert backend == "sqlite"


def test_database_from_env_postgres_url(monkeypatch: pytest.MonkeyPatch) -> None:
    raw = "postgresql://clown:clown@db:5432/clowncircus"
    monkeypatch.setenv("DATABASE_URL", raw)
    url, backend = database_from_env()
    assert url == raw
    assert backend == "postgres"


def test_database_from_env_empty_behaves_as_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "")
    url, backend = database_from_env()
    assert url == DEFAULT_DATABASE_URL
    assert backend == "sqlite"
