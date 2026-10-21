"""No customer data in telemetry (#40 D5, plan §4 criterion 10, #4 relay).

The leaderboard ``name`` must never reach the #4 OTel LoggingHandler bridge output
nor any log record on the /scores path. The bridge itself stays untouched.
"""

import logging
import uuid

from opentelemetry.sdk._logs import LoggingHandler

PLAYER_NAME = "ZZVULNNAME"


def _payload() -> dict:
    return {
        "name": PLAYER_NAME,
        "score": 42,
        "submissionId": str(uuid.uuid4()),
    }


def test_player_name_never_reaches_otel_emit(client, monkeypatch) -> None:
    """Emit-spy on the LoggingHandler instance the lifespan attaches to uvicorn.error."""
    uvicorn_logger = logging.getLogger("uvicorn.error")
    handlers = [h for h in uvicorn_logger.handlers if isinstance(h, LoggingHandler)]
    assert handlers, "lifespan must attach the #4 LoggingHandler bridge"
    bridge = handlers[0]

    emitted = []
    real_emit = bridge.emit

    def spy(record):
        emitted.append(record)
        return real_emit(record)

    monkeypatch.setattr(bridge, "emit", spy)

    # Provoke at least one emission so the spy is not vacuous, then submit the score.
    assert client.get("/health").status_code == 200
    response = client.post("/scores", json=_payload())
    assert response.status_code == 201

    assert emitted, "LoggingHandler.emit must have been called at least once"
    for record in emitted:
        assert PLAYER_NAME not in record.getMessage()


def test_player_name_never_appears_in_any_log_record(client, caplog) -> None:
    with caplog.at_level(logging.DEBUG):
        response = client.post("/scores", json=_payload())
    assert response.status_code == 201
    assert PLAYER_NAME not in caplog.text
