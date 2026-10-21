"""Leaderboard API routes (issue #40): POST /scores and GET /leaderboard."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Score
from app.schemas import LeaderboardResponse, ScoreRecord, ScoreSubmission

router = APIRouter()


def _record(score: Score) -> ScoreRecord:
    """Map the ORM row onto the API record (``created_at`` is exposed as ``date``)."""
    return ScoreRecord(id=score.id, name=score.name, score=score.score, date=score.created_at)


@router.post("/scores", status_code=201, response_model=ScoreRecord)
def submit_score(
    submission: ScoreSubmission, db: Session = Depends(get_db)
) -> ScoreRecord:
    stored = Score(
        name=submission.name,
        score=submission.score,
        submission_id=str(submission.submissionId),
    )
    db.add(stored)
    db.commit()
    db.refresh(stored)
    return _record(stored)


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(db: Session = Depends(get_db)) -> LeaderboardResponse:
    return LeaderboardResponse(entries=[])
