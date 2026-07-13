"""
C++ source instrumentor — Strategy A implementation.

Transforms supported C++ source into a trace-emitting equivalent.
The instrumented binary writes JSON event lines to stdout.

This module is internal to the C++ adapter.
It must not be imported by PRISM Core or other adapters.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Raw event schema — internal to the C++ adapter
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RawCppEvent:
    """
    A single event emitted by the instrumented C++ binary.

    This schema belongs to the C++ adapter boundary only.
    It must never escape into PRISM Core or Learning IR.
    """
    seq: int
    kind: str
    name: str | None
    cpp_type: str | None
    value: int | None
    line: int
    scope_name: str | None = None
    runtime_id: str | None = None


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# int x = expr;
_VAR_DECL = re.compile(r"^(\s*)int\s+(\w+)\s*=\s*(.+?)\s*;\s*$")

# x = expr;
_VAR_ASSIGN = re.compile(r"^(\s*)(\w+)\s*=\s*(.+?)\s*;\s*$")

# int main() {
_MAIN_OPEN = re.compile(r"^\s*int\s+main\s*\(\s*\)\s*\{\s*$")

# return <integer>;
_RETURN_STMT = re.compile(r"^(\s*)return\s+(\d+)\s*;\s*$")


# ---------------------------------------------------------------------------
# Runtime header
# ---------------------------------------------------------------------------

_RUNTIME_HEADER = """\
#include <iostream>
#include <string>

static void prism_emit(const std::string& json) {
    std::cout << json << "\\n";
    std::cout.flush();
}

static std::string prism_i(int v) {
    return std::to_string(v);
}

"""


class CppSourceInstrumentor:
    """
    Transforms a supported C++ source file into a trace-emitting equivalent.

    Strategy:
      - exec_start and scope_enter are emitted immediately after main() opens.
      - var_init is emitted after each int variable declaration.
      - var_write is emitted after each variable assignment.
      - scope_exit and exec_end are emitted BEFORE the return statement
        in main(). This is correct because return is the exit point and
        the closing brace is unreachable after return.

    The Sprint 0 profile requires normal completion via return 0, so
    intercepting return is reliable for all supported fixtures.
    """

    def instrument(self, source: str) -> str:
        lines = source.splitlines()
        output: list[str] = [_RUNTIME_HEADER]

        seq = [0]

        def next_seq() -> int:
            seq[0] += 1
            return seq[0]

        declared: dict[str, int] = {}

        def runtime_id(name: str) -> str:
            declared.setdefault(name, 1)
            return f"{name}#{declared[name]}"

        in_main = False
        scope_closed = [False]  # track whether we have already emitted scope_exit

        for line_num, line in enumerate(lines, start=1):
            stripped = line.rstrip()

            # ----------------------------------------------------------------
            # Detect int main() {
            # ----------------------------------------------------------------
            if not in_main and _MAIN_OPEN.match(stripped):
                output.append(stripped)
                in_main = True
                scope_closed[0] = False

                s = next_seq()
                output.append(
                    f'    prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"exec_start\\",'
                    f'\\"line\\":{line_num}}}");'
                )
                s = next_seq()
                output.append(
                    f'    prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"scope_enter\\",'
                    f'\\"scope_name\\":\\"main\\",\\"line\\":{line_num}}}");'
                )
                continue

            # Lines before main — pass through unchanged
            if not in_main:
                output.append(stripped)
                continue

            # ----------------------------------------------------------------
            # Detect return statement inside main — emit scope/exec END first
            # ----------------------------------------------------------------
            return_match = _RETURN_STMT.match(stripped)
            if return_match and not scope_closed[0]:
                indent = return_match.group(1) or "    "
                scope_closed[0] = True

                s = next_seq()
                output.append(
                    f'{indent}prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"scope_exit\\",'
                    f'\\"scope_name\\":\\"main\\",\\"line\\":{line_num}}}");'
                )
                s = next_seq()
                output.append(
                    f'{indent}prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"exec_end\\",'
                    f'\\"line\\":{line_num}}}");'
                )
                output.append(stripped)  # the return statement itself
                continue

            # ----------------------------------------------------------------
            # int variable declaration: int x = expr;
            # ----------------------------------------------------------------
            decl_match = _VAR_DECL.match(stripped)
            if decl_match:
                indent = decl_match.group(1) or "    "
                name   = decl_match.group(2)
                declared[name] = 1
                rid = runtime_id(name)
                output.append(stripped)
                s = next_seq()
                output.append(
                    f'{indent}prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"var_init\\",'
                    f'\\"runtime_id\\":\\"{rid}\\",\\"name\\":\\"{name}\\",'
                    f'\\"cpp_type\\":\\"int\\",\\"value\\":" + prism_i({name}) + '
                    f'",\\"line\\":{line_num}}}");'
                )
                continue

            # ----------------------------------------------------------------
            # Variable assignment: x = expr;
            # ----------------------------------------------------------------
            assign_match = _VAR_ASSIGN.match(stripped)
            if assign_match and not decl_match:
                indent = assign_match.group(1) or "    "
                name   = assign_match.group(2)
                if name in declared:
                    rid = runtime_id(name)
                    output.append(stripped)
                    s = next_seq()
                    output.append(
                        f'{indent}prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"var_write\\",'
                        f'\\"runtime_id\\":\\"{rid}\\",\\"name\\":\\"{name}\\",'
                        f'\\"value\\":" + prism_i({name}) + '
                        f'",\\"line\\":{line_num}}}");'
                    )
                    continue

            # ----------------------------------------------------------------
            # Everything else passes through unchanged
            # ----------------------------------------------------------------
            output.append(stripped)

        return "\n".join(output) + "\n"