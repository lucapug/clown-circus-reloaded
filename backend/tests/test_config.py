"""DATABASE_URL resolver tests (issue #3)."""

from app.config import DEFAULT_DATABASE_URL, resolve_database


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
