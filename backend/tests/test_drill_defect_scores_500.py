"""DRILL #60 — the env-gated scores defect is off by default and persists nothing.

The defect (``# DRILL #60`` marker in ``app/routes_leaderboard.py``) exists
only for the #60 on-call drill: with ``DRILL_DEFECT_SCORES_500=1`` a VALID
``POST /scores`` payload answers 500 BEFORE any crud call — no row is written
— while invalid payloads still hit the normal 422 validation path. Mirrors
``test_probe_5xx.py`` (monkeypatched env, file-based SQLite from conftest).
"""

import uuid

from fastapi.testclient import TestClient


def _payload(**overrides) -> dict:
    payload = {
        "name": "DRILL",
        "score": 10,
        "submissionId": str(uuid.uuid4()),
    }
    payload.update(overrides)
    return {key: value for key, value in payload.items() if value is not ...}


def test_drill_scores_500_off_by_default_is_201_and_persists(client, test_db, monkeypatch) -> None:
    """Default (env unset): submit_score behaves exactly as today — 201, row
    persisted. Pins off-by-default; prod never sets the gate."""
    monkeypatch.delenv("DRILL_DEFECT_SCORES_500", raising=False)
    response = client.post("/scores", json=_payload())
    assert response.status_code == 201
    assert [entry["name"] for entry in client.get("/leaderboard").json()["entries"]] == [
        "DRILL"
    ]


def test_drill_scores_500_gated_returns_500_and_persists_nothing(client, test_db, monkeypatch) -> None:
    """DRILL_DEFECT_SCORES_500=1 (dev drill only): valid payload → 500 AND
    zero rows — the raise precedes any crud call, so the save is cleanly
    rejected (no partial writes, the drill must not corrupt data)."""
    from app import models

    monkeypatch.setenv("DRILL_DEFECT_SCORES_500", "1")
    response = client.post("/scores", json=_payload())
    assert response.status_code == 500
    assert client.get("/leaderboard").json()["entries"] == []
    _engine, factory = test_db
    session = factory()
    try:
        assert session.query(models.Score).count() == 0
    finally:
        session.close()


def test_drill_scores_500_gated_invalid_payload_still_422(client, monkeypatch) -> None:
    """Gated: invalid payloads never reach the gate — FastAPI validation runs
    before the handler body, so they keep the normal 422 contract."""
    monkeypatch.setenv("DRILL_DEFECT_SCORES_500", "1")
    response = client.post("/scores", json=_payload(score=-1))
    assert response.status_code == 422
