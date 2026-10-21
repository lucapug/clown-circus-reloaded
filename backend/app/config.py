"""DATABASE_URL resolution (issue #3: configuration plumbing only).

No database layer exists yet (that is M3). ``DATABASE_URL`` unset or empty
resolves to the default SQLite URL; when set it is used verbatim. The coarse
``backend`` label (``sqlite`` / ``postgres``) feeds the startup log line and
carries no credentials.
"""

import os
from urllib.parse import urlsplit

DEFAULT_DATABASE_URL = "sqlite:///./clowncircus.db"

# Vite dev origins served by default; CORS_ORIGINS (comma-separated) replaces
# the allow-list (issue #40 D6; deployment-relevant, documented in the PR body).
DEFAULT_CORS_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")


def resolve_database(database_url: str | None = None) -> tuple[str, str]:
    """Return ``(url, backend)`` from a DATABASE_URL value.

    Unset/empty -> default SQLite URL. Set -> used verbatim. ``backend`` is
    ``sqlite``, ``postgres``, or the URL scheme for anything else.
    """
    url = database_url if database_url else DEFAULT_DATABASE_URL
    scheme = urlsplit(url).scheme.lower()
    backend = "postgres" if scheme in ("postgres", "postgresql") else scheme
    return url, backend


def database_from_env() -> tuple[str, str]:
    """Resolve ``(url, backend)`` from the ``DATABASE_URL`` environment variable."""
    return resolve_database(os.getenv("DATABASE_URL"))


def resolve_cors_origins(cors_origins: str | None = None) -> tuple[str, ...]:
    """Return the CORS allow-list from a ``CORS_ORIGINS`` value.

    Unset/empty -> ``DEFAULT_CORS_ORIGINS``; set -> comma-separated origins with
    surrounding whitespace stripped. Empty entries are dropped.
    """
    raw = cors_origins if cors_origins is not None else os.getenv("CORS_ORIGINS")
    if not raw:
        return DEFAULT_CORS_ORIGINS
    return tuple(origin.strip() for origin in raw.split(",") if origin.strip())
