"""POST /scores idempotency: submissionId replay and conflict semantics (#40 D1)."""

import uuid
from datetime import datetime


def _post(client, submission_id: str, name: str = "ACE", score: int = 10) -> dict:
    response = client.post(
        "/scores",
        json={"name": name, "score": score, "submissionId": submission_id},
    )
    assert response.status_code in (201, 409)
    return response


def test_identical_replay_stores_one_row_returns_same_record(client, test_db) -> None:
    from app import models

    submission_id = str(uuid.uuid4())
    first = _post(client, submission_id)
    second = _post(client, submission_id)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json() == second.json()
    _, factory = test_db
    with factory() as db:
        assert db.query(models.Score).count() == 1


def test_same_id_different_name_conflicts_409(client) -> None:
    submission_id = str(uuid.uuid4())
    assert _post(client, submission_id, name="ACE").status_code == 201
    assert _post(client, submission_id, name="BOB").status_code == 409


def test_same_id_different_score_conflicts_409(client) -> None:
    submission_id = str(uuid.uuid4())
    assert _post(client, submission_id, score=10).status_code == 201
    assert _post(client, submission_id, score=20).status_code == 409


def test_conflict_leaves_stored_row_unchanged(client, test_db) -> None:
    from app import models

    submission_id = str(uuid.uuid4())
    stored = _post(client, submission_id).json()
    conflict = _post(client, submission_id, name="BOB", score=99)
    assert conflict.status_code == 409
    _, factory = test_db
    with factory() as db:
        row = (
            db.query(models.Score)
            .filter(models.Score.submission_id == submission_id)
            .one()
        )
        assert row.name == stored["name"]
        assert row.score == stored["score"]
        # tz-agnostic instant comparison: SQLite may drop the offset on round-trip
        assert row.created_at.replace(tzinfo=None) == datetime.fromisoformat(
            stored["date"]
        ).replace(tzinfo=None)


def test_different_submission_id_creates_new_row(client, test_db) -> None:
    from app import models

    first = _post(client, str(uuid.uuid4()))
    second = _post(client, str(uuid.uuid4()))
    assert first.status_code == 201
    assert second.status_code == 201
    _, factory = test_db
    with factory() as db:
        assert db.query(models.Score).count() == 2
