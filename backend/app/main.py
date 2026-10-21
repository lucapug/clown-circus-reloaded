"""FastAPI application factory for Clown Circus Reloaded.

Exposes a ``create_app()`` factory plus a module-level ``app`` so the
standard command ``uv run uvicorn app.main:app`` works as-is.

When a built frontend exists at ``frontend/dist`` (as inside the Docker
image), the backend serves it with an SPA fallback registered last so
``/health``, ``/docs`` and ``/openapi.json`` keep precedence.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from opentelemetry.sdk._logs import LoggingHandler

from app import models  # noqa: F401  (registers the mappings on Base.metadata)
from app.config import database_from_env
from app.database import Base, get_engine

logger = logging.getLogger("uvicorn.error")

BASE_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = BASE_DIR / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    _, backend = database_from_env()
    logger.info("database backend: %s", backend)
    Base.metadata.create_all(get_engine())
    handler = LoggingHandler(level=logging.INFO)
    logger.addHandler(handler)
    try:
        yield
    finally:
        logger.removeHandler(handler)


def create_app() -> FastAPI:
    app = FastAPI(title="Clown Circus Reloaded", lifespan=lifespan)

    @app.get("/health")
    def health() -> dict[str, str]:
        logger.info("health check ok")
        return {"status": "ok"}

    if DIST_DIR.is_dir():
        app.mount(
            "/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets"
        )

        @app.get("/", include_in_schema=False)
        def index() -> FileResponse:
            return FileResponse(DIST_DIR / "index.html")

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa_fallback(full_path: str) -> FileResponse:
            if "." in Path(full_path).name:
                raise HTTPException(status_code=404)
            return FileResponse(DIST_DIR / "index.html")

    return app


app = create_app()
