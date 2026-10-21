"""Pydantic v2 API schemas (issue #40).

Class names mirror the committed openapi.yaml component names so the generated
schema's $refs line up with the contract (parity test D2).
"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, Field


def _reject_boolean(value: object) -> object:
    """Pydantic v2 lax mode coerces ``true`` -> 1; the contract's ``type: integer``
    does not include JSON booleans, so they are rejected explicitly while numeric
    strings still coerce."""
    if isinstance(value, bool):
        # pydantic v2 validators must raise ValueError (not TypeError) for 422.
        raise ValueError("boolean is not a valid integer")  # noqa: TRY004
    return value


NonNegativeInt = Annotated[int, BeforeValidator(_reject_boolean), Field(ge=0)]


class HealthStatus(BaseModel):
    """Decision C: the /health body stays exactly {"status": "ok"}."""

    status: Literal["ok"]


class ScoreSubmission(BaseModel):
    """POST /scores body; the server stores ``name`` verbatim (no trim)."""

    name: str = Field(min_length=1, max_length=10, pattern=r"^[a-zA-Z0-9 ]+$")
    score: NonNegativeInt
    submissionId: UUID


class ScoreRecord(BaseModel):
    """Stored record; ``date`` is the API name for the model's ``created_at``."""

    id: int
    name: str
    score: int
    date: datetime


class LeaderboardEntry(BaseModel):
    rank: int
    name: str
    score: int
    date: datetime


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
