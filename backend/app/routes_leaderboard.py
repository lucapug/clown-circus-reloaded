"""Leaderboard API routes (issue #40): POST /scores and GET /leaderboard."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.schemas import LeaderboardEntry, LeaderboardResponse, ScoreRecord, ScoreSubmission

router = APIRouter()

_CONFLICT_RESPONSE = {
    "description": (
        "Same submissionId with a different name or score; the stored record "
        "is unchanged (no mutation)."
    ),
    "content": {
        "application/json": {
            "schema": {
                "type": "object",
                "properties": {"detail": {"type": "string"}},
            }
        }
    },
}


def _record(score) -> ScoreRecord:
    """Map the ORM row onto the API record (``created_at`` is exposed as ``date``)."""
    return ScoreRecord(
        id=score.id, name=score.name, score=score.score, date=score.created_at
    )


@router.post(
    "/scores",
    status_code=201,
    response_model=ScoreRecord,
    responses={409: _CONFLICT_RESPONSE},
)
def submit_score(
    submission: ScoreSubmission, db: Session = Depends(get_db)
) -> ScoreRecord:
    stored, _created = crud.create_or_get(db, submission)
    if stored is None:
        # Body shape is non-normative (contract: the client only branches on status).
        raise HTTPException(
            status_code=409,
            detail="submissionId already stored with a different payload",
        )
    return _record(stored)


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    limit: int = Query(default=10, ge=1, le=100), db: Session = Depends(get_db)
) -> LeaderboardResponse:
    rows = crud.list_leaderboard(db, limit)
    entries = [
        LeaderboardEntry(rank=position, name=row.name, score=row.score, date=row.created_at)
        for position, row in enumerate(rows, start=1)
    ]
    return LeaderboardResponse(entries=entries)
