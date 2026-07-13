"""
Tests for language adapter and sandbox contracts.
"""

import pytest
from pydantic import ValidationError

from contracts.language import (
    LanguageAdapter,
    LanguageAdapterRegistry,
    ExecutionRequest,
    ValidationResult,
    ValidationViolation,
    PreparedExecution,
)
from contracts.language.models import SandboxWorkloadFile
from contracts.sandbox.models import SandboxWorkload, SandboxResult


# ---------------------------------------------------------------------------
# ExecutionRequest
# ---------------------------------------------------------------------------


class TestExecutionRequest:
    def test_creates_valid_request(self):
        req = ExecutionRequest(
            language_id="cpp",
            source_code="int main() { return 0; }",
            execution_id="exec-001",
        )
        assert req.language_id == "cpp"
        assert req.execution_id == "exec-001"

    def test_is_immutable(self):
        req = ExecutionRequest(
            language_id="cpp",
            source_code="int main() {}",
            execution_id="exec-001",
        )
        with pytest.raises(Exception):
            req.language_id = "python"  # type: ignore

    def test_requires_language_id(self):
        with pytest.raises(ValidationError):
            ExecutionRequest(
                source_code="int main() {}",
                execution_id="exec-001",
            )  # type: ignore


# ---------------------------------------------------------------------------
# ValidationResult
# ---------------------------------------------------------------------------


class TestValidationResult:
    def test_supported_result(self):
        result = ValidationResult(supported=True)
        assert result.supported is True
        assert result.violations == []

    def test_unsupported_result_with_violations(self):
        violation = ValidationViolation(
            code="CPP_PROFILE_LOOP_UNSUPPORTED",
            line=4,
            message="Loops are not supported.",
        )
        result = ValidationResult(supported=False, violations=[violation])
        assert result.supported is False
        assert len(result.violations) == 1
        assert result.violations[0].code == "CPP_PROFILE_LOOP_UNSUPPORTED"


# ---------------------------------------------------------------------------
# SandboxWorkload / SandboxResult
# ---------------------------------------------------------------------------


class TestSandboxModels:
    def test_workload_defaults(self):
        workload = SandboxWorkload(
            files=[],
            command=["echo", "hello"],
        )
        assert workload.network_enabled is False
        assert workload.timeout_ms == 10_000
        assert workload.memory_limit_mb == 64

    def test_sandbox_result_normal(self):
        result = SandboxResult(exit_code=0, stdout="hello\n")
        assert result.exit_code == 0
        assert result.timed_out is False

    def test_sandbox_result_timeout(self):
        result = SandboxResult(exit_code=1, timed_out=True)
        assert result.timed_out is True


# ---------------------------------------------------------------------------
# LanguageAdapterRegistry
# ---------------------------------------------------------------------------


class TestLanguageAdapterRegistry:
    def _make_mock_adapter(self, language_id: str):
        from contracts.learning_ir.models import LearningTrace

        class MockAdapter:
            def __init__(self, lid):
                self.language_id = lid

            def validate(self, request):
                return ValidationResult(supported=True)

            def prepare(self, request):
                return PreparedExecution(files=[], command=["echo"])

            def transform(self, result):
                return LearningTrace(events=[])

        adapter = MockAdapter(language_id)
        assert isinstance(adapter, LanguageAdapter)
        return adapter

    def test_register_and_resolve(self):
        registry = LanguageAdapterRegistry()
        adapter = self._make_mock_adapter("cpp")
        registry.register(adapter)
        resolved = registry.resolve("cpp")
        assert resolved.language_id == "cpp"

    def test_resolve_unknown_raises(self):
        registry = LanguageAdapterRegistry()
        with pytest.raises(KeyError, match="python"):
            registry.resolve("python")

    def test_available_languages(self):
        registry = LanguageAdapterRegistry()
        registry.register(self._make_mock_adapter("cpp"))
        registry.register(self._make_mock_adapter("python"))
        languages = registry.available_languages()
        assert "cpp" in languages
        assert "python" in languages

    def test_register_non_adapter_raises(self):
        registry = LanguageAdapterRegistry()
        with pytest.raises(TypeError):
            registry.register("not_an_adapter")  # type: ignore