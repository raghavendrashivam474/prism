"""
Unit tests for the C++ Trace Transformer.

These tests operate purely on RawCppEvent objects — no compiler, no Docker.
"""

import pytest

from adapters.languages.cpp.instrumentation.instrumentor import RawCppEvent
from adapters.languages.cpp.transformer.transformer import CppTraceTransformer
from contracts.learning_ir.models import EventType


@pytest.fixture
def transformer():
    return CppTraceTransformer()


def arithmetic_program_events() -> list[RawCppEvent]:
    """
    Raw events equivalent to:
        int main() {
            int x = 10;
            x = 20;
            x = x + 5;
            return 0;
        }
    """
    return [
        RawCppEvent(seq=1, kind="exec_start",  name=None,  cpp_type=None,  value=None, line=1),
        RawCppEvent(seq=2, kind="scope_enter", name=None,  cpp_type=None,  value=None, line=1, scope_name="main"),
        RawCppEvent(seq=3, kind="var_init",    name="x",   cpp_type="int", value=10,   line=2, runtime_id="x#1"),
        RawCppEvent(seq=4, kind="var_write",   name="x",   cpp_type=None,  value=20,   line=3, runtime_id="x#1"),
        RawCppEvent(seq=5, kind="var_write",   name="x",   cpp_type=None,  value=25,   line=4, runtime_id="x#1"),
        RawCppEvent(seq=6, kind="scope_exit",  name=None,  cpp_type=None,  value=None, line=6, scope_name="main"),
        RawCppEvent(seq=7, kind="exec_end",    name=None,  cpp_type=None,  value=None, line=6),
    ]


class TestTransformerEventTypes:
    def test_event_count(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert len(trace.events) == 7

    def test_first_event_execution_started(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.events[0].type == EventType.EXECUTION_STARTED

    def test_second_event_scope_entered(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.events[1].type == EventType.SCOPE_ENTERED

    def test_third_event_entity_created(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.events[2].type == EventType.ENTITY_CREATED

    def test_fourth_event_value_changed(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.events[3].type == EventType.ENTITY_VALUE_CHANGED

    def test_fifth_event_value_changed(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.events[4].type == EventType.ENTITY_VALUE_CHANGED

    def test_penultimate_event_scope_exited(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.events[-2].type == EventType.SCOPE_EXITED

    def test_last_event_execution_completed(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.events[-1].type == EventType.EXECUTION_COMPLETED


class TestTransformerPayloads:
    def test_entity_created_payload(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        payload = trace.events[2].payload
        assert payload["displayName"] == "x"
        assert payload["dataType"] == "int"
        assert payload["value"] == 10
        assert payload["kind"] == "variable"

    def test_first_value_change_previous_and_new(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        payload = trace.events[3].payload
        assert payload["previousValue"] == 10
        assert payload["value"] == 20

    def test_second_value_change_previous_and_new(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        payload = trace.events[4].payload
        assert payload["previousValue"] == 20
        assert payload["value"] == 25

    def test_scope_entered_payload(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        payload = trace.events[1].payload
        assert payload["displayName"] == "main"
        assert "scopeId" in payload


class TestTransformerEntityIds:
    def test_entity_id_is_not_bare_name(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        created = trace.events[2]
        assert created.entity_id != "x"

    def test_entity_id_uses_var_prefix(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.events[2].entity_id.startswith("var_x_")

    def test_entity_id_consistent_across_all_events(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        created  = trace.events[2]
        changed1 = trace.events[3]
        changed2 = trace.events[4]
        assert created.entity_id == changed1.entity_id == changed2.entity_id

    def test_multiple_variables_have_distinct_ids(self, transformer):
        raw = [
            RawCppEvent(seq=1, kind="exec_start",  name=None, cpp_type=None, value=None, line=1),
            RawCppEvent(seq=2, kind="scope_enter", name=None, cpp_type=None, value=None, line=1, scope_name="main"),
            RawCppEvent(seq=3, kind="var_init", name="a", cpp_type="int", value=1, line=2, runtime_id="a#1"),
            RawCppEvent(seq=4, kind="var_init", name="b", cpp_type="int", value=2, line=3, runtime_id="b#1"),
            RawCppEvent(seq=5, kind="scope_exit", name=None, cpp_type=None, value=None, line=4, scope_name="main"),
            RawCppEvent(seq=6, kind="exec_end",   name=None, cpp_type=None, value=None, line=4),
        ]
        trace = transformer.transform(raw)
        created = [e for e in trace.events if e.type == EventType.ENTITY_CREATED]
        assert len(created) == 2
        ids = {e.entity_id for e in created}
        assert len(ids) == 2


class TestTransformerSequence:
    def test_sequences_are_one_based_and_contiguous(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        for i, event in enumerate(trace.events, start=1):
            assert event.sequence == i

    def test_source_lines_are_retained(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.events[2].source.line == 2  # var_init on line 2
        assert trace.events[3].source.line == 3  # var_write on line 3
        assert trace.events[4].source.line == 4  # var_write on line 4

    def test_language_id_is_cpp(self, transformer):
        trace = transformer.transform(arithmetic_program_events())
        assert trace.language_id == "cpp"

    def test_execution_id_propagated(self, transformer):
        trace = transformer.transform(arithmetic_program_events(), execution_id="exec-42")
        assert trace.execution_id == "exec-42"


class TestTransformerFailures:
    def test_compilation_failed_category(self, transformer):
        trace = transformer.make_failure_trace(
            category="compilation_failed",
            message="Syntax error.",
            diagnostics=["error: expected ';'"],
        )
        assert trace.events[0].type == EventType.EXECUTION_FAILED
        assert trace.events[0].payload["category"] == "compilation_failed"
        assert trace.events[0].payload["diagnostics"] == ["error: expected ';'"]

    def test_timeout_category(self, transformer):
        trace = transformer.make_failure_trace(
            category="execution_timed_out",
            message="Timed out.",
        )
        assert trace.events[0].payload["category"] == "execution_timed_out"

    def test_failure_trace_sequence_is_one(self, transformer):
        trace = transformer.make_failure_trace(
            category="internal_error",
            message="Something went wrong.",
        )
        assert trace.events[0].sequence == 1

    def test_failure_trace_is_valid_learning_trace(self, transformer):
        trace = transformer.make_failure_trace(
            category="trace_invalid",
            message="No events.",
        )
        # If this doesn't raise, the LearningTrace schema validation passed
        assert len(trace.events) == 1