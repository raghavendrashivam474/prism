"""
Tests for Learning IR v0.1 schema, validation, and constraints.
"""

import pytest
from pydantic import ValidationError

from contracts.learning_ir.models import (
    EventType,
    LearningEvent,
    LearningTrace,
    SourceLocation,
)


def make_event(
    sequence: int = 1,
    event_type: str = EventType.EXECUTION_STARTED,
    line: int = 1,
    entity_id: str | None = None,
    payload: dict | None = None,
) -> LearningEvent:
    return LearningEvent(
        irVersion="0.1",
        sequence=sequence,
        type=event_type,
        source=SourceLocation(line=line),
        entityId=entity_id,
        payload=payload or {},
    )


# ---------------------------------------------------------------------------
# SourceLocation
# ---------------------------------------------------------------------------


class TestSourceLocation:
    def test_valid_line(self):
        loc = SourceLocation(line=5)
        assert loc.line == 5

    def test_line_must_be_positive(self):
        with pytest.raises(ValidationError):
            SourceLocation(line=0)

    def test_line_must_not_be_negative(self):
        with pytest.raises(ValidationError):
            SourceLocation(line=-1)


# ---------------------------------------------------------------------------
# LearningEvent — envelope
# ---------------------------------------------------------------------------


class TestLearningEvent:
    def test_execution_started_event(self):
        event = make_event(sequence=1, event_type=EventType.EXECUTION_STARTED)
        assert event.type == EventType.EXECUTION_STARTED
        assert event.sequence == 1
        assert event.ir_version == "0.1"

    def test_entity_created_requires_entity_id(self):
        with pytest.raises(ValidationError, match="entityId"):
            make_event(sequence=1, event_type=EventType.ENTITY_CREATED, entity_id=None)

    def test_entity_value_changed_requires_entity_id(self):
        with pytest.raises(ValidationError, match="entityId"):
            make_event(sequence=1, event_type=EventType.ENTITY_VALUE_CHANGED, entity_id=None)

    def test_entity_id_must_not_be_bare_name(self):
        with pytest.raises(ValidationError, match="bare display name"):
            make_event(
                sequence=1,
                event_type=EventType.ENTITY_CREATED,
                entity_id="x",
            )

    def test_entity_id_with_underscore_suffix_accepted(self):
        event = make_event(
            sequence=1,
            event_type=EventType.ENTITY_CREATED,
            entity_id="var_x_1",
        )
        assert event.entity_id == "var_x_1"

    def test_entity_id_with_hash_suffix_accepted(self):
        event = make_event(
            sequence=1,
            event_type=EventType.ENTITY_CREATED,
            entity_id="x#1",
        )
        assert event.entity_id == "x#1"

    def test_sequence_must_be_positive(self):
        with pytest.raises(ValidationError):
            make_event(sequence=0)

    def test_event_is_immutable(self):
        event = make_event()
        with pytest.raises(Exception):
            event.sequence = 99  # type: ignore

    def test_scope_events_do_not_require_entity_id(self):
        event = make_event(
            sequence=1,
            event_type=EventType.SCOPE_ENTERED,
            entity_id=None,
        )
        assert event.entity_id is None

    def test_payload_defaults_to_empty_dict(self):
        event = make_event()
        assert event.payload == {}


# ---------------------------------------------------------------------------
# LearningTrace — sequence validation
# ---------------------------------------------------------------------------


class TestLearningTrace:
    def test_valid_trace(self):
        events = [
            make_event(sequence=1, event_type=EventType.EXECUTION_STARTED),
            make_event(sequence=2, event_type=EventType.EXECUTION_COMPLETED),
        ]
        trace = LearningTrace(events=events)
        assert len(trace.events) == 2

    def test_non_monotonic_sequence_rejected(self):
        events = [
            make_event(sequence=1, event_type=EventType.EXECUTION_STARTED),
            make_event(sequence=3, event_type=EventType.EXECUTION_COMPLETED),
        ]
        with pytest.raises(ValidationError, match="sequence"):
            LearningTrace(events=events)

    def test_duplicate_sequence_rejected(self):
        events = [
            make_event(sequence=1, event_type=EventType.EXECUTION_STARTED),
            make_event(sequence=1, event_type=EventType.EXECUTION_COMPLETED),
        ]
        with pytest.raises(ValidationError, match="sequence"):
            LearningTrace(events=events)

    def test_empty_trace_valid(self):
        trace = LearningTrace(events=[])
        assert trace.events == []

    def test_trace_stores_language_and_execution_id(self):
        trace = LearningTrace(
            execution_id="exec-001",
            language_id="cpp",
            events=[],
        )
        assert trace.execution_id == "exec-001"
        assert trace.language_id == "cpp"

    def test_trace_ir_version(self):
        trace = LearningTrace(events=[])
        assert trace.ir_version == "0.1"

    def test_sequence_must_start_at_one(self):
        events = [
            make_event(sequence=2, event_type=EventType.EXECUTION_STARTED),
        ]
        with pytest.raises(ValidationError, match="sequence"):
            LearningTrace(events=events)