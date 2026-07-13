"""
C++ Trace Transformer.

Converts a list of RawCppEvent objects into a Learning IR LearningTrace.

This is the boundary where C++ adapter knowledge ends and
language-neutral PRISM knowledge begins.

Rules enforced here:
  - Stable trace-local entity IDs  (var_x_1, not "x")
  - Previous value tracking for entity.value_changed
  - Monotonic sequence numbers
  - Scope IDs for scope events
"""

from __future__ import annotations

from contracts.learning_ir.models import (
    EventType,
    LearningEvent,
    LearningTrace,
    SourceLocation,
)
from adapters.languages.cpp.instrumentation.instrumentor import RawCppEvent

_SCOPE_ID_MAIN = "scope_main_1"


class CppTraceTransformer:
    """
    Transforms raw C++ trace events into a LearningTrace.
    """

    def transform(
        self,
        raw_events: list[RawCppEvent],
        execution_id: str = "",
    ) -> LearningTrace:
        """
        Map each RawCppEvent to the corresponding Learning IR event type.
        Assigns stable entity IDs and tracks previous values.
        """
        ir_events: list[LearningEvent] = []
        seq = [0]

        # name -> stable entityId  (keyed by runtime_id when available)
        entity_id_map: dict[str, str] = {}
        # entityId -> current value (for previous-value tracking)
        entity_values: dict[str, int | None] = {}
        # name -> counter (to generate var_name_N)
        entity_counter: dict[str, int] = {}

        def next_seq() -> int:
            seq[0] += 1
            return seq[0]

        def resolve_entity_id(name: str, runtime_id: str | None) -> str:
            key = runtime_id if runtime_id else name
            if key not in entity_id_map:
                n = entity_counter.get(name, 0) + 1
                entity_counter[name] = n
                entity_id_map[key] = f"var_{name}_{n}"
            return entity_id_map[key]

        def safe_line(line: int) -> int:
            return max(line, 1)

        for raw in raw_events:

            if raw.kind == "exec_start":
                ir_events.append(LearningEvent(
                    irVersion="0.1",
                    sequence=next_seq(),
                    type=EventType.EXECUTION_STARTED,
                    source=SourceLocation(line=safe_line(raw.line)),
                    payload={},
                ))

            elif raw.kind == "scope_enter":
                scope_name = raw.scope_name or "main"
                ir_events.append(LearningEvent(
                    irVersion="0.1",
                    sequence=next_seq(),
                    type=EventType.SCOPE_ENTERED,
                    source=SourceLocation(line=safe_line(raw.line)),
                    payload={
                        "scopeId": _SCOPE_ID_MAIN,
                        "displayName": scope_name,
                    },
                ))

            elif raw.kind == "var_init":
                if raw.name is None:
                    continue
                entity_id = resolve_entity_id(raw.name, raw.runtime_id)
                value = raw.value if raw.value is not None else 0
                entity_values[entity_id] = value

                ir_events.append(LearningEvent(
                    irVersion="0.1",
                    sequence=next_seq(),
                    type=EventType.ENTITY_CREATED,
                    source=SourceLocation(line=safe_line(raw.line)),
                    entityId=entity_id,
                    payload={
                        "kind": "variable",
                        "displayName": raw.name,
                        "dataType": raw.cpp_type or "int",
                        "value": value,
                        "scopeId": _SCOPE_ID_MAIN,
                    },
                ))

            elif raw.kind == "var_write":
                if raw.name is None:
                    continue
                key = raw.runtime_id if raw.runtime_id else raw.name
                entity_id = entity_id_map.get(key)
                if entity_id is None:
                    continue

                previous_value = entity_values.get(entity_id)
                new_value = raw.value if raw.value is not None else 0
                entity_values[entity_id] = new_value

                ir_events.append(LearningEvent(
                    irVersion="0.1",
                    sequence=next_seq(),
                    type=EventType.ENTITY_VALUE_CHANGED,
                    source=SourceLocation(line=safe_line(raw.line)),
                    entityId=entity_id,
                    payload={
                        "previousValue": previous_value,
                        "value": new_value,
                    },
                ))

            elif raw.kind == "scope_exit":
                scope_name = raw.scope_name or "main"
                ir_events.append(LearningEvent(
                    irVersion="0.1",
                    sequence=next_seq(),
                    type=EventType.SCOPE_EXITED,
                    source=SourceLocation(line=safe_line(raw.line)),
                    payload={
                        "scopeId": _SCOPE_ID_MAIN,
                        "displayName": scope_name,
                    },
                ))

            elif raw.kind == "exec_end":
                ir_events.append(LearningEvent(
                    irVersion="0.1",
                    sequence=next_seq(),
                    type=EventType.EXECUTION_COMPLETED,
                    source=SourceLocation(line=safe_line(raw.line)),
                    payload={},
                ))

        return LearningTrace(
            irVersion="0.1",
            execution_id=execution_id,
            language_id="cpp",
            events=ir_events,
        )

    def make_failure_trace(
        self,
        category: str,
        message: str,
        diagnostics: list[str] | None = None,
        execution_id: str = "",
    ) -> LearningTrace:
        """Produce a LearningTrace containing a single execution.failed event."""
        event = LearningEvent(
            irVersion="0.1",
            sequence=1,
            type=EventType.EXECUTION_FAILED,
            source=SourceLocation(line=1),
            payload={
                "category": category,
                "message": message,
                "diagnostics": diagnostics or [],
            },
        )
        return LearningTrace(
            irVersion="0.1",
            execution_id=execution_id,
            language_id="cpp",
            events=[event],
        )