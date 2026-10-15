"""FastAPI application factory for Clown Circus Reloaded.

Exposes a ``create_app()`` factory plus a module-level ``app`` so the
standard command ``uv run uvicorn app.main:app`` works as-is.
"""

from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="Clown Circus Reloaded")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
