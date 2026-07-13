"""
Tests for the Execution Service pipeline.

Uses mock adapters and sandboxes — no compiler, no Docker.
"""

import pytest

from contracts.language import LanguageAdapterRegistry
from contracts.language.models import (
    ExecutionRequest,
    PreparedExecution,
    SandboxWorkloadFile,
    ValidationResult,
    ValidationViolation,
)
from contracts.learning_ir.models import EventType, LearningEvent, LearningTrace, SourceLocation
from contracts.sandbox.models import SandboxResult, SandboxWorkload
from core.execution.service import ExecutionService


# ---------------------------------------------------------------------------
# Test doubles
# ---------------------------------------------------------------------------


class _SuccessAdapter:
    language_id = "cpp"

    def validate(self, request):
        return ValidationResult(supported=True)

    def prepare(self, request):
        return PreparedExecution(
            files=[SandboxWorkloadFile(path="run.sh", content="echo ok")],
            command=["bash", "run.sh"],
        )

    def transform(self, result, execution_id=""):
        return LearningTrace(
            execution_id=execution_id,
            language_id="cpp",
            events=[
                LearningEvent(
                    sequence=1,
                    type=EventType.EXECUTION_STARTED,
                    source=SourceLocation(line=1),
                    payload={},
                )
            ],
        )


class _UnsupportedAdapter:
    language_id = "cpp"

    def validate(self, request):
        return ValidationResult(
            supported=False,
            violations=[
                ValidationViolation(
                    code="CPP_PROFILE_LOOP_UNSUPPORTED",
                    line=3,
                    message="Loops are not supported.",
                )
            ],
        )

    def prepare(self, request):
        raise AssertionError("prepare() must not be called for unsupported source")

    def transform(self, result, execution_id=""):
        raise AssertionError("transform() must not be called for unsupported source")


class _PrepareFailsAdapter:
    language_id = "cpp"

    def validate(self, request):
        return ValidationResult(supported=True)

    def prepare(self, request):
        raise RuntimeError("Instrumentor crashed.")

    def transform(self, result, execution_id=""):
        raise AssertionError("Should not reach transform")


class _SuccessSandbox:
    def execute(self, workload):
        return SandboxResult(exit_code=0, stdout="trace", stderr="")


class _FailingSandbox:
    def execute(self, workload):
        raise RuntimeError("Docker unavailable.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service(adapter, sandbox):
    registry = LanguageAdapterRegistry()
    registry.register(adapter)
    return ExecutionService(language_registry=registry, sandbox_provider=sandbox)


def _make_request(source="int main() { return 0; }", language="cpp"):
    return ExecutionRequest(
        language_id=language,
        source_code=source,
        execution_id="test-exec-001",
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestExecutionServiceSuccess:
    def test_returns_learning_trace(self):
        service = _make_service(_SuccessAdapter(), _SuccessSandbox())
        trace = service.execute(_make_request())
        assert isinstance(trace, LearningTrace)

    def test_trace_has_events(self):
        service = _make_service(_SuccessAdapter(), _SuccessSandbox())
        trace = service.execute(_make_request())
        assert len(trace.events) > 0

    def test_execution_id_propagated(self):
        service = _make_service(_SuccessAdapter(), _SuccessSandbox())
        request = ExecutionRequest(
            language_id="cpp",
            source_code="int main() { return 0; }",
            execution_id="my-exec-id",
        )
        trace = service.execute(request)
        assert trace.execution_id == "my-exec-id"


class TestExecutionServiceFailures:
    def test_unknown_language_returns_failure(self):
        registry = LanguageAdapterRegistry()
        service = ExecutionService(
            language_registry=registry,
            sandbox_provider=_SuccessSandbox(),
        )
        trace = service.execute(_make_request(language="python"))
        assert trace.events[0].type == EventType.EXECUTION_FAILED
        assert trace.events[0].payload["category"] == "internal_error"

    def test_unsupported_profile_returns_failure(self):
        service = _make_service(_UnsupportedAdapter(), _SuccessSandbox())
        trace = service.execute(_make_request())
        assert trace.events[0].type == EventType.EXECUTION_FAILED
        assert trace.events[0].payload["category"] == "unsupported_profile"

    def test_unsupported_profile_includes_violations(self):
        service = _make_service(_UnsupportedAdapter(), _SuccessSandbox())
        trace = service.execute(_make_request())
        violations = trace.events[0].payload.get("violations", [])
        assert len(violations) > 0

    def test_sandbox_failure_returns_structured_failure(self):
        service = _make_service(_SuccessAdapter(), _FailingSandbox())
        trace = service.execute(_make_request())
        assert trace.events[0].type == EventType.EXECUTION_FAILED
        assert trace.events[0].payload["category"] == "internal_error"

    def test_prepare_failure_returns_structured_failure(self):
        service = _make_service(_PrepareFailsAdapter(), _SuccessSandbox())
        trace = service.execute(_make_request())
        assert trace.events[0].type == EventType.EXECUTION_FAILED
        assert trace.events[0].payload["category"] == "internal_error"

    def test_failure_trace_has_single_event(self):
        registry = LanguageAdapterRegistry()
        service = ExecutionService(
            language_registry=registry,
            sandbox_provider=_SuccessSandbox(),
        )
        trace = service.execute(_make_request(language="rust"))
        assert len(trace.events) == 1


class TestExecutionServiceBoundary:
    """
    Verify the architectural boundary: ExecutionService must not import
    any concrete infrastructure. We check import statements only,
    not docstrings or comments.
    """

    def _import_lines(self) -> list[str]:
        """Return only the import statement lines from service.py."""
        import core.execution.service as svc
        import inspect
        source = inspect.getsource(svc)
        return [
            line.strip()
            for line in source.splitlines()
            if line.strip().startswith("import ") or line.strip().startswith("from ")
        ]

    def test_service_does_not_import_docker(self):
        import_lines = self._import_lines()
        for line in import_lines:
            assert "docker" not in line.lower(), (
                f"ExecutionService imports Docker infrastructure: {line!r}"
            )

    def test_service_does_not_import_subprocess(self):
        import_lines = self._import_lines()
        for line in import_lines:
            assert "subprocess" not in line.lower(), (
                f"ExecutionService imports subprocess: {line!r}"
            )

    def test_service_does_not_import_clang(self):
        import_lines = self._import_lines()
        for line in import_lines:
            assert "clang" not in line.lower(), (
                f"ExecutionService imports Clang tooling: {line!r}"
            )

    def test_service_does_not_reference_cpp_adapter_directly(self):
        import core.execution.service as svc
        import inspect
        source = inspect.getsource(svc)
        assert "CppLanguageAdapter" not in source, (
            "ExecutionService must not reference CppLanguageAdapter directly."
        )

    def test_service_only_imports_from_contracts_and_stdlib(self):
        """
        Every import in ExecutionService must come from contracts or
        Python stdlib. No adapters, no sandboxes, no concrete tooling.
        """
        import_lines = self._import_lines()
        allowed_prefixes = (
            "from __future__",
            "from contracts.",
            "from contracts ",
            "import contracts",
        )
        for line in import_lines:
            assert any(line.startswith(p) for p in allowed_prefixes), (
                f"ExecutionService has an unexpected import: {line!r}\n"
                "Only 'contracts' and '__future__' imports are permitted."
            )