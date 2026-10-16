"""DATABASE_URL resolution (issue #3: configuration plumbing only).

No database layer exists yet (that is M3). ``DATABASE_URL`` unset or empty
resolves to the default SQLite URL; when set it is used verbatim. The coarse
``backend`` label (``sqlite`` / ``postgres``) feeds the startup log line and
carries no credentials.
"""

import os
from urllib.parse import urlsplit

DEFAULT_DATABASE_URL = "sqlite:///./clowncircus.db"


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
