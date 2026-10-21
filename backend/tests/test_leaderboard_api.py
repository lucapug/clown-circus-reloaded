"""GET /leaderboard ordering, tie-break, limit, and rank tests (#40 D1)."""

import uuid
from datetime import UTC, datetime


def _post(client, name: str, score: int) -> dict:
    response = client.post(
        "/scores",
        json={"name": name, "score": score, "submissionId": str(uuid.uuid4())},
    )
    assert response.status_code == 201
    return response.json()


def test_ordering_score_desc(client) -> None:
    _post(client, "AAA", 1)
    _post(client, "BBB", 9)
    _post(client, "CCC", 5)
    response = client.get("/leaderboard")
    assert response.status_code == 200
    scores = [entry["score"] for entry in response.json()["entries"]]
    assert scores == [9, 5, 1]


def test_tie_break_created_at_asc(client, test_db) -> None:
    """Controlled timestamps: SQLite microsecond collisions would hide the ASC order."""
    from app import models

    _, factory = test_db
    earlier = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    later = datetime(2026, 1, 2, 12, 0, 0, tzinfo=UTC)
    with factory() as db:
        db.add(
            models.Score(
                name="LATER", score=7, submission_id=str(uuid.uuid4()), created_at=later
            )
        )
        db.add(
            models.Score(
                name="EARLY",
                score=7,
                submission_id=str(uuid.uuid4()),
                created_at=earlier,
            )
        )
        db.commit()
    response = client.get("/leaderboard")
    assert response.status_code == 200
    entries = response.json()["entries"]
    assert [entry["name"] for entry in entries] == ["EARLY", "LATER"]


def test_limit_1_returns_one_entry(client) -> None:
    _post(client, "AAA", 1)
    _post(client, "BBB", 2)
    _post(client, "CCC", 3)
    response = client.get("/leaderboard", params={"limit": 1})
    assert response.status_code == 200
    assert len(response.json()["entries"]) == 1


def test_limit_100_accepted(client) -> None:
    _post(client, "AAA", 1)
    response = client.get("/leaderboard", params={"limit": 100})
    assert response.status_code == 200
    assert len(response.json()["entries"]) == 1


def test_limit_0_is_422(client) -> None:
    response = client.get("/leaderboard", params={"limit": 0})
    assert response.status_code == 422


def test_limit_101_is_422(client) -> None:
    response = client.get("/leaderboard", params={"limit": 101})
    assert response.status_code == 422


def test_default_limit_is_10(client, test_db) -> None:
    from app import models

    _, factory = test_db
    with factory() as db:
        for index in range(11):
            db.add(
                models.Score(
                    name=f"P{index:02d}",
                    score=index,
                    submission_id=str(uuid.uuid4()),
                )
            )
        db.commit()
    response = client.get("/leaderboard")
    assert response.status_code == 200
    assert len(response.json()["entries"]) == 10


def test_rank_is_one_based_sequential(client) -> None:
    _post(client, "AAA", 1)
    _post(client, "BBB", 2)
    _post(client, "CCC", 3)
    response = client.get("/leaderboard")
    assert response.status_code == 200
    ranks = [entry["rank"] for entry in response.json()["entries"]]
    assert ranks == [1, 2, 3]
