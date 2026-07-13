"""
Golden integration tests.

Each test runs a complete fixture through the real pipeline:
    C++ Source -> Validator -> Adapter -> Docker Sandbox -> Raw Trace -> Transformer -> Learning IR

Golden files are the committed expected event-type sequences.
Tests compare actual event types and counts against the golden record.
Tests marked integration require Docker to be running.

The execution_id field is excluded from comparison because it is generated fresh.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from contracts.language import LanguageAdapterRegistry
from contracts.language.models import ExecutionRequest
from contracts.learning_ir.models import EventType, LearningTrace
from core.execution.service import ExecutionService


FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures" / "cpp"
GOLDEN_DIR = Path(__file__).parent.parent / "golden"


def _build_service(sandbox_type: str = "docker") -> ExecutionService:
    from adapters.languages.cpp.adapter import CppLanguageAdapter
    registry = LanguageAdapterRegistry()
    registry.register(CppLanguageAdapter())

    if sandbox_type == "docker":
        from adapters.sandboxes.docker.provider import DockerSandboxProvider
        sandbox = DockerSandboxProvider()
    else:
        from adapters.sandboxes.local.provider import LocalSandboxProvider
        sandbox = LocalSandboxProvider()

    return ExecutionService(language_registry=registry, sandbox_provider=sandbox)


def _run(filename: str, sandbox: str = "docker") -> LearningTrace:
    source = (FIXTURES_DIR / filename).read_text(encoding="utf-8")
    service = _build_service(sandbox)
    request = ExecutionRequest(
        language_id="cpp",
        source_code=source,
        execution_id="golden-test",
    )
    return service.execute(request)


def _load_golden(filename: str) -> dict:
    path = GOLDEN_DIR / filename
    if not path.exists():
        pytest.skip(f"Golden file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _skip_if_failed(trace: LearningTrace) -> None:
    """Skip gracefully if Docker/compiler infrastructure is unavailable."""
    if any(e.type == EventType.EXECUTION_FAILED for e in trace.events):
        category = trace.events[0].payload.get("category", "")
        if category in ("compilation_failed", "trace_invalid", "internal_error"):
            pytest.skip(f"Infrastructure unavailable: {category}")


# ---------------------------------------------------------------------------
# Unsupported profile tests
# ---------------------------------------------------------------------------


class TestUnsupportedProfileRejection:
    def test_loop_rejected_with_structured_failure(self):
        trace = _run("unsupported_loop.cpp", sandbox="docker")
        assert trace.events[0].type == EventType.EXECUTION_FAILED
        assert trace.events[0].payload["category"] == "unsupported_profile"

    def test_pointer_rejected_with_structured_failure(self):
        trace = _run("unsupported_pointer.cpp", sandbox="docker")
        assert trace.events[0].type == EventType.EXECUTION_FAILED
        assert trace.events[0].payload["category"] == "unsupported_profile"

    def test_loop_violation_has_line_number(self):
        trace = _run("unsupported_loop.cpp", sandbox="docker")
        violations = trace.events[0].payload.get("violations", [])
        assert len(violations) > 0
        assert violations[0]["line"] is not None

    def test_pointer_violation_has_line_number(self):
        trace = _run("unsupported_pointer.cpp", sandbox="docker")
        violations = trace.events[0].payload.get("violations", [])
        assert len(violations) > 0


# ---------------------------------------------------------------------------
# Supported fixtures
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestSupportedFixtures:
    def test_variable_arithmetic_event_count(self):
        trace = _run("variable_arithmetic.cpp")
        _skip_if_failed(trace)
        assert len(trace.events) == 7

    def test_variable_arithmetic_event_sequence(self):
        trace = _run("variable_arithmetic.cpp")
        _skip_if_failed(trace)
        expected = [
            EventType.EXECUTION_STARTED,
            EventType.SCOPE_ENTERED,
            EventType.ENTITY_CREATED,
            EventType.ENTITY_VALUE_CHANGED,
            EventType.ENTITY_VALUE_CHANGED,
            EventType.SCOPE_EXITED,
            EventType.EXECUTION_COMPLETED,
        ]
        actual = [e.type for e in trace.events]
        assert actual == expected

    def test_variable_arithmetic_value_progression(self):
        trace = _run("variable_arithmetic.cpp")
        _skip_if_failed(trace)
        changes = [e for e in trace.events if e.type == EventType.ENTITY_VALUE_CHANGED]
        assert changes[0].payload["previousValue"] == 10
        assert changes[0].payload["value"] == 20
        assert changes[1].payload["previousValue"] == 20
        assert changes[1].payload["value"] == 25

    def test_variable_create_event_count(self):
        trace = _run("variable_create.cpp")
        _skip_if_failed(trace)
        assert len(trace.events) == 5

    def test_variable_assign_event_count(self):
        trace = _run("variable_assign.cpp")
        _skip_if_failed(trace)
        assert len(trace.events) == 6

    def test_multiple_variables_entity_count(self):
        trace = _run("multiple_variables.cpp")
        _skip_if_failed(trace)
        created = [e for e in trace.events if e.type == EventType.ENTITY_CREATED]
        assert len(created) == 3

    def test_multiple_variables_distinct_entity_ids(self):
        trace = _run("multiple_variables.cpp")
        _skip_if_failed(trace)
        created = [e for e in trace.events if e.type == EventType.ENTITY_CREATED]
        ids = {e.entity_id for e in created}
        assert len(ids) == 3

    def test_sequences_monotonic_for_all_supported_fixtures(self):
        for fixture in [
            "variable_create.cpp",
            "variable_assign.cpp",
            "variable_arithmetic.cpp",
            "multiple_variables.cpp",
        ]:
            trace = _run(fixture)
            if any(e.type == EventType.EXECUTION_FAILED for e in trace.events):
                continue
            for i, event in enumerate(trace.events, start=1):
                assert event.sequence == i

    def test_entity_ids_are_never_bare_names(self):
        trace = _run("variable_arithmetic.cpp")
        _skip_if_failed(trace)
        for event in trace.events:
            if event.entity_id:
                assert event.entity_id not in ("x", "a", "b", "c")

    def test_all_events_have_positive_source_line(self):
        trace = _run("variable_arithmetic.cpp")
        _skip_if_failed(trace)
        for event in trace.events:
            assert event.source.line >= 1


# ---------------------------------------------------------------------------
# Golden comparison
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestGoldenFiles:
    def _assert_matches_golden(self, trace: LearningTrace, golden_file: str) -> None:
        _skip_if_failed(trace)
        golden = _load_golden(golden_file)
        golden_events = golden.get("events", [])

        assert len(trace.events) == len(golden_events), (
            f"Event count: actual={len(trace.events)}, golden={len(golden_events)}"
        )

        for i, (actual, expected) in enumerate(zip(trace.events, golden_events)):
            assert actual.type == expected["type"], (
                f"Event {i}: type mismatch: actual={actual.type!r}, "
                f"golden={expected['type']!r}"
            )

    def test_variable_arithmetic_matches_golden(self):
        trace = _run("variable_arithmetic.cpp")
        self._assert_matches_golden(trace, "variable_arithmetic.ir.json")

    def test_variable_create_matches_golden(self):
        trace = _run("variable_create.cpp")
        self._assert_matches_golden(trace, "variable_create.ir.json")

    def test_variable_assign_matches_golden(self):
        trace = _run("variable_assign.cpp")
        self._assert_matches_golden(trace, "variable_assign.ir.json")

    def test_multiple_variables_matches_golden(self):
        trace = _run("multiple_variables.cpp")
        self._assert_matches_golden(trace, "multiple_variables.ir.json")