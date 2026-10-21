"""CORS middleware behavior (#40 D6).

Defaults: the Vite dev origins (http://localhost:5173, http://127.0.0.1:5173).
``CORS_ORIGINS`` (comma-separated) replaces the default allow-list.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

DEFAULT_ORIGIN = "http://localhost:5173"


@pytest.fixture()
def make_client(test_db, monkeypatch):
    def _make(cors_origins=None):
        from app.database import get_db

        if cors_origins is None:
            monkeypatch.delenv("CORS_ORIGINS", raising=False)
        else:
            monkeypatch.setenv("CORS_ORIGINS", cors_origins)
        _, factory = test_db

        def override_get_db():
            db = factory()
            try:
                yield db
            finally:
                db.close()

        app = create_app()
        app.dependency_overrides[get_db] = override_get_db
        return TestClient(app)

    return _make


def test_preflight_from_default_origin_is_allowed(make_client) -> None:
    client = make_client()
    response = client.options(
        "/scores",
        headers={
            "Origin": DEFAULT_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == DEFAULT_ORIGIN


def test_unknown_origin_gets_no_allow_origin_header(make_client) -> None:
    client = make_client()
    response = client.options(
        "/scores",
        headers={
            "Origin": "https://unknown.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in response.headers


def test_cors_origins_env_override_replaces_defaults(make_client) -> None:
    client = make_client(cors_origins="https://x.example")
    allowed = client.options(
        "/scores",
        headers={
            "Origin": "https://x.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "https://x.example"

    rejected = client.options(
        "/scores",
        headers={
            "Origin": DEFAULT_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in rejected.headers
