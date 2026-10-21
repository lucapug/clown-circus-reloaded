"""DB-level proof that submission_id is uniquely constrained (#40 D3).

Imports stay function-level so the module collects cleanly even before the
implementation exists (TDD red commit).
"""

import uuid

import pytest


def _engine(tmp_path):
    from sqlalchemy import create_engine

    from app.database import Base

    engine = create_engine(
        f"sqlite:///{tmp_path / 'constraints.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    return engine


def test_inspector_finds_unique_on_submission_id(tmp_path) -> None:
    from sqlalchemy import inspect

    inspector = inspect(_engine(tmp_path))
    columns = {col["name"]: col for col in inspector.get_columns("scores")}
    assert "submission_id" in columns
    unique_constraints = inspector.get_unique_constraints("scores")
    unique_indexes = [
        index for index in inspector.get_indexes("scores") if index.get("unique")
    ]
    flagged = (
        columns["submission_id"].get("unique") is True
        or any(
            "submission_id" in (constraint.get("column_names") or [])
            for constraint in unique_constraints
        )
        or any(
            "submission_id" in index.get("column_names", [])
            for index in unique_indexes
        )
    )
    assert flagged, (
        "Inspector must find a unique index/constraint on scores.submission_id"
    )


def test_direct_duplicate_submission_id_raises_integrity_error(tmp_path) -> None:
    """Bypasses the API: the constraint lives in the database, not the route logic."""
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.orm import sessionmaker

    from app import models

    engine = _engine(tmp_path)
    session = sessionmaker(bind=engine)()
    submission_id = str(uuid.uuid4())
    session.add(models.Score(name="AAA", score=1, submission_id=submission_id))
    session.commit()
    session.add(models.Score(name="BBB", score=2, submission_id=submission_id))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
    session.close()
