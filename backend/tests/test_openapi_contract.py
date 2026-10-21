# backend/tests/test_openapi_contract.py
"""Anti-rot check: the committed openapi.yaml must stay machine-valid.

Parses the contract at the repo root with PyYAML and validates it with
openapi-spec-validator, so the file cannot rot silently.
"""

from pathlib import Path

import yaml
from openapi_spec_validator import validate

ROOT = Path(__file__).resolve().parents[2]  # repo root; openapi.yaml lives there


def test_committed_openapi_is_valid():
    spec = yaml.safe_load((ROOT / "openapi.yaml").read_text())
    validate(spec)
