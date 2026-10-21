"""POST /scores validation cases (#40 D1) plus pinned /health and /docs reachability."""

import uuid

from fastapi.testclient import TestClient

from app.main import create_app


def _payload(**overrides) -> dict:
    payload = {
        "name": "ACE",
        "score": 10,
        "submissionId": str(uuid.uuid4()),
    }
    payload.update(overrides)
    return {key: value for key, value in payload.items() if value is not ...}


def test_missing_name_is_422(client) -> None:
    response = client.post("/scores", json=_payload(name=...))
    assert response.status_code == 422


def test_missing_score_is_422(client) -> None:
    response = client.post("/scores", json=_payload(score=...))
    assert response.status_code == 422


def test_missing_submission_id_is_422(client) -> None:
    response = client.post("/scores", json=_payload(submissionId=...))
    assert response.status_code == 422


def test_empty_name_is_422(client) -> None:
    response = client.post("/scores", json=_payload(name=""))
    assert response.status_code == 422


def test_name_11_chars_is_422(client) -> None:
    response = client.post("/scores", json=_payload(name="ABCDEFGHIJK"))
    assert response.status_code == 422


def test_name_10_chars_is_201(client) -> None:
    response = client.post("/scores", json=_payload(name="ABCDEFGHIJ"))
    assert response.status_code == 201


def test_name_1_char_is_201(client) -> None:
    response = client.post("/scores", json=_payload(name="A"))
    assert response.status_code == 201


def test_name_disallowed_char_is_422(client) -> None:
    response = client.post("/scores", json=_payload(name="clown!"))
    assert response.status_code == 422


def test_name_internal_space_is_201(client) -> None:
    response = client.post("/scores", json=_payload(name="AB CD"))
    assert response.status_code == 201


def test_name_stored_verbatim_no_trim(client) -> None:
    """Contract wording: the client trims; the server stores the wire shape untouched."""
    response = client.post("/scores", json=_payload(name=" A1 "))
    assert response.status_code == 201
    assert response.json()["name"] == " A1 "


def test_negative_score_is_422(client) -> None:
    response = client.post("/scores", json=_payload(score=-1))
    assert response.status_code == 422


def test_zero_score_is_201(client) -> None:
    response = client.post("/scores", json=_payload(score=0))
    assert response.status_code == 201


def test_score_non_numeric_string_is_422(client) -> None:
    response = client.post("/scores", json=_payload(score="abc"))
    assert response.status_code == 422


def test_score_bool_is_422(client) -> None:
    response = client.post("/scores", json=_payload(score=True))
    assert response.status_code == 422


def test_score_float_is_422(client) -> None:
    response = client.post("/scores", json=_payload(score=1.5))
    assert response.status_code == 422


def test_submission_id_not_a_uuid_is_422(client) -> None:
    response = client.post("/scores", json=_payload(submissionId="not-a-uuid"))
    assert response.status_code == 422


def test_health_body_pinned() -> None:
    """Decision C: the /health body stays exactly {"status": "ok"}."""
    response = TestClient(create_app()).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_docs_reachable() -> None:
    response = TestClient(create_app()).get("/docs")
    assert response.status_code == 200
