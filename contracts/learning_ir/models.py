"""
Learning IR v0.1 data models.

All events share a common envelope.
Payloads are typed per event type.
Entity identities are trace-local, not display-name-based.
"""

from __future__ import annotations

import re
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, model_validator


IR_VERSION = "0.1"


class EventType(StrEnum):
    """All valid Learning IR v0.1 event types."""

    EXECUTION_STARTED = "execution.started"
    EXECUTION_COMPLETED = "execution.completed"
    EXECUTION_FAILED = "execution.failed"
    SCOPE_ENTERED = "scope.entered"
    SCOPE_EXITED = "scope.exited"
    ENTITY_CREATED = "entity.created"
    ENTITY_VALUE_CHANGED = "entity.value_changed"


class SourceLocation(BaseModel):
    """Source code position for a learning event."""

    line: int = Field(ge=1, description="1-based source line number.")

    model_config = {"frozen": True}


class LearningEvent(BaseModel):
    """
    A single Learning IR event.

    All events share this envelope.
    Entity events carry an entityId.
    entityId must be a stable trace-local identifier — never a bare display name.
    """

    ir_version: str = Field(
        default=IR_VERSION,
        alias="irVersion",
    )
    sequence: int = Field(ge=1, description="1-based monotonically increasing event order.")
    type: EventType = Field(description="Event type.")
    source: SourceLocation = Field(description="Source location.")
    entity_id: str | None = Field(
        default=None,
        alias="entityId",
        description=(
            "Trace-local entity identifier. Present for entity.* events. "
            "Must not equal the display name."
        ),
    )
    payload: dict = Field(default_factory=dict)

    model_config = {
        "frozen": True,
        "populate_by_name": True,
    }

    @model_validator(mode="after")
    def validate_entity_id_present_for_entity_events(self) -> "LearningEvent":
        entity_event_types = {
            EventType.ENTITY_CREATED,
            EventType.ENTITY_VALUE_CHANGED,
        }
        if self.type in entity_event_types and not self.entity_id:
            raise ValueError(
                f"Events of type '{self.type}' require a non-empty entityId."
            )
        return self

    @model_validator(mode="after")
    def validate_entity_id_not_bare_name(self) -> "LearningEvent":
        """
        entityId must contain an underscore or hash followed by at least one digit.
        Valid:   var_x_1   x#1   var_count_2
        Invalid: x         count someVar
        """
        if self.entity_id:
            pattern = r"^.+[_#]\w*\d+\w*$"
            if not re.match(pattern, self.entity_id):
                raise ValueError(
                    f"entityId '{self.entity_id}' appears to be a bare display name. "
                    "Use a stable trace-local identifier such as 'var_x_1'."
                )
        return self


class LearningTrace(BaseModel):
    """An ordered sequence of Learning IR events produced by one execution."""

    ir_version: str = Field(default=IR_VERSION, alias="irVersion")
    execution_id: str = Field(default="")
    language_id: str = Field(default="")
    events: list[LearningEvent] = Field(default_factory=list)

    model_config = {
        "frozen": True,
        "populate_by_name": True,
    }

    @model_validator(mode="after")
    def validate_sequence_is_monotonic(self) -> "LearningTrace":
        for i, event in enumerate(self.events):
            expected = i + 1
            if event.sequence != expected:
                raise ValueError(
                    f"Event at index {i} has sequence {event.sequence}, "
                    f"expected {expected}. Sequences must be 1-based and contiguous."
                )
        return self


__all__ = [
    "IR_VERSION",
    "EventType",
    "SourceLocation",
    "LearningEvent",
    "LearningTrace",
]