"""
Tests for the execution API route.
Uses FastAPI TestClient with mock ExecutionService.
No real Docker or compiler required.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.dependencies import get_execution_service
from contracts.language.models import ExecutionRequest as CoreExecutionRequest
from contracts.learning_ir.models import (
    EventType,
    LearningEvent,
    LearningTrace,
    SourceLocation,
)


# ---------------------------------------------------------------------------
# Test doubles
# ---------------------------------------------------------------------------


def _make_success_trace(execution_id: str = "test-exec") -> LearningTrace:
    return LearningTrace(
        execution_id=execution_id,
        language_id="cpp",
        events=[
            LearningEvent(
                sequence=1,
                type=EventType.EXECUTION_STARTED,
                source=SourceLocation(line=1),
                payload={},
            ),
            LearningEvent(
                sequence=2,
                type=EventType.EXECUTION_COMPLETED,
                source=SourceLocation(line=6),
                payload={},
            ),
        ],
    )


def _make_failure_trace(category: str = "unsupported_profile") -> LearningTrace:
    return LearningTrace(
        execution_id="test-exec",
        language_id="cpp",
        events=[
            LearningEvent(
                sequence=1,
                type=EventType.EXECUTION_FAILED,
                source=SourceLocation(line=1),
                payload={
                    "category": category,
                    "message": "Test failure.",
                    "diagnostics": [],
                },
            )
        ],
    )


class MockExecutionService:
    def __init__(self, trace: LearningTrace):
        self._trace = trace

    def execute(self, request: CoreExecutionRequest) -> LearningTrace:
        return self._trace


def _client(service) -> TestClient:
    app.dependency_overrides[get_execution_service] = lambda: service
    return TestClient(app)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    def test_health_returns_ok(self):
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Execution endpoint
# ---------------------------------------------------------------------------


class TestExecutionEndpoint:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_valid_request_returns_200(self):
        response = _client(MockExecutionService(_make_success_trace())).post(
            "/api/v1/executions",
            json={"languageId": "cpp", "source": "int main() { return 0; }"},
        )
        assert response.status_code == 200

    def test_response_contains_trace(self):
        response = _client(MockExecutionService(_make_success_trace())).post(
            "/api/v1/executions",
            json={"languageId": "cpp", "source": "int main() { return 0; }"},
        )
        assert "trace" in response.json()

    def test_trace_contains_events(self):
        response = _client(MockExecutionService(_make_success_trace())).post(
            "/api/v1/executions",
            json={"languageId": "cpp", "source": "int main() { return 0; }"},
        )
        trace = response.json()["trace"]
        assert len(trace["events"]) == 2

    def test_trace_ir_version(self):
        response = _client(MockExecutionService(_make_success_trace())).post(
            "/api/v1/executions",
            json={"languageId": "cpp", "source": "int main() { return 0; }"},
        )
        assert response.json()["trace"]["irVersion"] == "0.1"

    def test_event_types_serialised_as_strings(self):
        response = _client(MockExecutionService(_make_success_trace())).post(
            "/api/v1/executions",
            json={"languageId": "cpp", "source": "int main() { return 0; }"},
        )
        events = response.json()["trace"]["events"]
        assert events[0]["type"] == "execution.started"
        assert events[1]["type"] == "execution.completed"

    def test_failure_trace_returns_200_with_failed_event(self):
        response = _client(
            MockExecutionService(_make_failure_trace("unsupported_profile"))
        ).post(
            "/api/v1/executions",
            json={"languageId": "cpp", "source": "int main() { for(;;){} }"},
        )
        assert response.status_code == 200
        events = response.json()["trace"]["events"]
        assert events[0]["type"] == "execution.failed"
        assert events[0]["payload"]["category"] == "unsupported_profile"

    def test_missing_source_returns_422(self):
        response = TestClient(app).post(
            "/api/v1/executions",
            json={"languageId": "cpp"},
        )
        assert response.status_code == 422

    def test_missing_language_id_returns_422(self):
        response = TestClient(app).post(
            "/api/v1/executions",
            json={"source": "int main() { return 0; }"},
        )
        assert response.status_code == 422

    def test_empty_source_returns_422(self):
        response = TestClient(app).post(
            "/api/v1/executions",
            json={"languageId": "cpp", "source": ""},
        )
        assert response.status_code == 422

    def test_compilation_failure_category_preserved(self):
        response = _client(
            MockExecutionService(_make_failure_trace("compilation_failed"))
        ).post(
            "/api/v1/executions",
            json={"languageId": "cpp", "source": "int main() { int x = 10 }"},
        )
        events = response.json()["trace"]["events"]
        assert events[0]["payload"]["category"] == "compilation_failed"

    def test_source_locations_in_all_events(self):
        response = _client(MockExecutionService(_make_success_trace())).post(
            "/api/v1/executions",
            json={"languageId": "cpp", "source": "int main() { return 0; }"},
        )
        for event in response.json()["trace"]["events"]:
            assert event["source"]["line"] >= 1

    def test_route_does_not_import_docker(self):
        import inspect
        import apps.api.routes.executions as route_module
        source = inspect.getsource(route_module)
        import_lines = [
            line.strip() for line in source.splitlines()
            if line.strip().startswith("import ") or line.strip().startswith("from ")
        ]
        for line in import_lines:
            assert "docker" not in line.lower(), (
                f"Route must not import Docker: {line!r}"
            )