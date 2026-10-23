"""PROBE #59 — the temporary 5xx probe is off by default, 500 when gated.

The probe (`# PROBE #59` marker in ``app/main.py``) exists only to prove the
#59 alert fires and clears post-merge on dev (docs/runbook.md). These tests
pin its contract: without ``DRILL_PROBE_5XX`` it is invisible (404), with
``DRILL_PROBE_5XX=1`` it answers 500 — which the OTel auto-instrumentation
records into the ``http_server_request_duration_seconds_count`` histogram the
alert queries.
"""

from fastapi.testclient import TestClient

from app.main import create_app


def test_probe_5xx_off_by_default_returns_404(monkeypatch) -> None:
    """Default (env unset): the probe must be invisible — 404, like any
    unknown route; prod builds never set the gate."""
    monkeypatch.delenv("DRILL_PROBE_5XX", raising=False)
    client = TestClient(create_app())
    assert client.get("/__probe/5xx").status_code == 404


def test_probe_5xx_gated_on_returns_500(monkeypatch) -> None:
    """DRILL_PROBE_5XX=1 (dev drill only): the probe answers 500."""
    monkeypatch.setenv("DRILL_PROBE_5XX", "1")
    client = TestClient(create_app())
    assert client.get("/__probe/5xx").status_code == 500
