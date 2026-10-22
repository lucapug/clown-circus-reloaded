"""Health endpoint test (issue #1 acceptance criterion 1)."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_head_root_returns_200_empty_body() -> None:
    """HEAD / answers Render's pre-check (issue #47) instead of 405."""
    client = TestClient(create_app())
    response = client.head("/")
    assert response.status_code == 200
    assert response.content == b""
