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
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from opentelemetry.sdk._logs import LoggingHandler

from app import models  # noqa: F401  (registers the mappings on Base.metadata)
from app.config import database_from_env, resolve_cors_origins
from app.database import Base, get_engine
from app.routes_leaderboard import router as leaderboard_router
from app.schemas import HealthStatus

logger = logging.getLogger("uvicorn.error")

BASE_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = BASE_DIR / "frontend" / "dist"


def mask_database_url(url: str) -> str:
    """Scheme + host (+port) only — never credentials, path, or DB name (Decision C)."""
    parts = urlsplit(url)
    host = parts.hostname or ""
    if parts.port:
        host = f"{host}:{parts.port}"
    return f"{parts.scheme}://{host}"


@asynccontextmanager
async def lifespan(_: FastAPI):
    url, _ = database_from_env()
    logger.info("database target: %s", mask_database_url(url))
    Base.metadata.create_all(get_engine())
    handler = LoggingHandler(level=logging.INFO)
    logger.addHandler(handler)
    try:
        yield
    finally:
        logger.removeHandler(handler)


def create_app() -> FastAPI:
    app = FastAPI(title="Clown Circus Reloaded", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolve_cors_origins()),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(leaderboard_router)

    @app.get("/health", response_model=HealthStatus)
    def health() -> HealthStatus:
        logger.info("health check ok")
        return HealthStatus(status="ok")

    # Answer Render's HEAD / pre-check quietly (2026-10-21 logs showed 405).
    @app.head("/", include_in_schema=False)
    def head_index() -> Response:
        return Response(status_code=200)

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
