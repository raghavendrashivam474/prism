"""
Raw C++ trace parser.

Parses JSON lines emitted by the instrumented C++ binary
into typed RawCppEvent objects.

This module is internal to the C++ adapter.
"""

from __future__ import annotations

import json

from adapters.languages.cpp.instrumentation.instrumentor import RawCppEvent


class RawCppTraceParser:
    """
    Parses stdout from an instrumented C++ binary into RawCppEvent objects.

    Each stdout line is expected to be a self-contained JSON object.
    Non-JSON lines are silently skipped — the binary may produce other output.
    Malformed JSON lines are skipped.
    """

    def parse(self, stdout: str) -> list[RawCppEvent]:
        """
        Parse all JSON lines from stdout into an ordered list of RawCppEvent.
        """
        events: list[RawCppEvent] = []

        for raw_line in stdout.splitlines():
            line = raw_line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            event = self._to_event(data)
            if event is not None:
                events.append(event)

        return events

    @staticmethod
    def _to_event(data: dict) -> RawCppEvent | None:
        """Convert a parsed JSON dict into a RawCppEvent."""
        try:
            kind = str(data.get("kind", ""))
            seq = int(data.get("seq", 0))
            line = int(data.get("line", 1))
            if line < 1:
                line = 1

            raw_value = data.get("value")
            value: int | None = int(raw_value) if raw_value is not None else None

            return RawCppEvent(
                seq=seq,
                kind=kind,
                name=data.get("name"),
                cpp_type=data.get("cpp_type"),
                value=value,
                line=line,
                scope_name=data.get("scope_name"),
                runtime_id=data.get("runtime_id"),
            )
        except (KeyError, ValueError, TypeError):
            return None