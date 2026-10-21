"""Generated-vs-committed OpenAPI parity (#40 D2 normalization rule).

Documented rule (restated in the PR):
1. path + method sets equal between the app's /openapi.json and the root openapi.yaml.
2. Per operation, the generated status-code set must cover the committed behavioral
   statuses; committed-only 400/500 are exempt (the contract's own descriptions mark
   them as client-side classification notes, not endpoint-declared statuses).
3. For request/2xx component schemas, compare after local $ref resolution: equal
   ``required`` lists and equal property-name -> JSON-type maps, preserving
   ``format``/``const``/``pattern``/``minLength``/``maxLength``/``minimum``/``maximum``
   where the contract declares them; titles/descriptions/examples/servers/info are
   ignored.
4. For 422, FastAPI's native HTTPValidationError/ValidationError is accepted for the
   committed ``ValidationError`` iff ``detail`` is an array of objects whose properties
   include ``loc``/``msg``/``type``/``input``.
5. /health's generated schema must carry ``properties.status`` (HealthStatus model).
"""

from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from app.main import create_app

ROOT = Path(__file__).resolve().parents[2]

COMPONENTS = (
    "HealthStatus",
    "ScoreSubmission",
    "ScoreRecord",
    "LeaderboardEntry",
    "LeaderboardResponse",
)

CONSTRAINT_RULES = (
    "format",
    "const",
    "pattern",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
)


def _resolve_refs(node, components):
    if isinstance(node, dict):
        if "$ref" in node:
            name = node["$ref"].split("/")[-1]
            return _resolve_refs(components[name], components)
        return {key: _resolve_refs(value, components) for key, value in node.items()}
    if isinstance(node, list):
        return [_resolve_refs(item, components) for item in node]
    return node


def _assert_schema_comparable(committed, generated, where: str) -> None:
    assert committed.get("type") == generated.get("type"), f"{where}: type mismatch"
    for rule in CONSTRAINT_RULES:
        if rule in committed:
            assert generated.get(rule) == committed[rule], f"{where}: {rule} mismatch"
    if "required" in committed:
        assert set(committed["required"]) == set(generated.get("required") or []), (
            f"{where}: required mismatch"
        )
    for prop, committed_prop in (committed.get("properties") or {}).items():
        generated_props = generated.get("properties") or {}
        assert prop in generated_props, f"{where}: property {prop} missing in generated"
        _assert_schema_comparable(
            committed_prop, generated_props[prop], f"{where}.{prop}"
        )
    if "items" in committed:
        _assert_schema_comparable(committed["items"], generated["items"], f"{where}[]")


def test_generated_openapi_matches_committed_contract() -> None:
    generated = TestClient(create_app()).get("/openapi.json").json()
    committed = yaml.safe_load((ROOT / "openapi.yaml").read_text())
    g_paths, c_paths = generated["paths"], committed["paths"]

    # 1. path + method sets equal.
    g_ops = {f"{method.upper()} {path}" for path, spec in g_paths.items() for method in spec}
    c_ops = {f"{method.upper()} {path}" for path, spec in c_paths.items() for method in spec}
    assert g_ops == c_ops

    # 2. generated covers every committed behavioral status (400/500 exempt).
    for path, methods in c_paths.items():
        for method, operation in methods.items():
            committed_codes = set(operation.get("responses") or {})
            generated_codes = set(g_paths[path][method].get("responses") or {})
            missing = committed_codes - generated_codes
            assert missing <= {"400", "500"}, (
                f"{method.upper()} {path}: generated schema missing {missing}"
            )

    # 3. component schemas match after local $ref resolution.
    g_components = generated["components"]["schemas"]
    c_components = committed["components"]["schemas"]
    for name in COMPONENTS:
        _assert_schema_comparable(
            _resolve_refs(c_components[name], c_components),
            _resolve_refs(g_components[name], g_components),
            name,
        )

    # 4. 422: FastAPI-native detail shape accepted for the committed ValidationError.
    detail = g_components["HTTPValidationError"]["properties"]["detail"]
    assert detail["type"] == "array"
    item_props = detail["items"]["properties"]
    assert {"loc", "msg", "type", "input"} <= set(item_props)

    # 5. /health carries properties.status (Decision C body unchanged).
    assert "status" in g_components["HealthStatus"]["properties"]
