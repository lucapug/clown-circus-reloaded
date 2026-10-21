"""CRUD operations for the leaderboard (issue #40).

``create_or_get`` implements the ``submissionId`` idempotency key: a lookup
first, then an insert guarded by the DB-level unique constraint as an
IntegrityError backstop for concurrent first-writes. ``list_leaderboard`` is
the read side of the brief's file tree (order_by score DESC, created_at ASC,
limit). No player names are ever logged or recorded on spans from here
(plan §4 criterion 10).
"""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Score
from app.schemas import ScoreSubmission


def _find(db: Session, submission_id: str) -> Score | None:
    return db.execute(
        select(Score).where(Score.submission_id == submission_id)
    ).scalar_one_or_none()


def _matches(stored: Score, submission: ScoreSubmission) -> bool:
    return stored.name == submission.name and stored.score == submission.score


def create_or_get(
    db: Session, submission: ScoreSubmission
) -> tuple[Score | None, bool]:
    """Return ``(row, created)``; ``row is None`` signals a 409 conflict.

    Identical replay of a stored submissionId -> the ORIGINALLY STORED row,
    created=False. Same id with a different name/score -> None (no mutation).
    """
    existing = _find(db, str(submission.submissionId))
    if existing is not None:
        return (existing, False) if _matches(existing, submission) else (None, False)

    stored = Score(
        name=submission.name,
        score=submission.score,
        submission_id=str(submission.submissionId),
    )
    db.add(stored)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race against a concurrent first write of the same submissionId.
        db.rollback()
        existing = _find(db, str(submission.submissionId))
        if existing is not None and _matches(existing, submission):
            return existing, False
        return None, False
    db.refresh(stored)
    return stored, True


def list_leaderboard(db: Session, limit: int) -> list[Score]:
    """Leaderboard read (brief file tree: the query lives in crud, not the route).

    Ordering per spec §7: score DESC, created_at ASC as the tie-break, capped
    at ``limit``.
    """
    return list(
        db.execute(
            select(Score).order_by(Score.score.desc(), Score.created_at.asc()).limit(limit)
        )
        .scalars()
        .all()
    )
