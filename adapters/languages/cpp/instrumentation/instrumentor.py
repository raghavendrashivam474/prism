"""
C++ source instrumentor — Strategy A implementation.

Transforms supported C++ source into a trace-emitting equivalent.
The instrumented binary writes JSON event lines to stdout.

This module is internal to the C++ adapter.
It must not be imported by PRISM Core or other adapters.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


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
    kind: str           # exec_start | scope_enter | var_init | var_write | scope_exit | exec_end
    name: str | None
    cpp_type: str | None
    value: int | None
    line: int
    scope_name: str | None = None
    runtime_id: str | None = None   # e.g. "x#1"


# ---------------------------------------------------------------------------
# Patterns for line classification
# ---------------------------------------------------------------------------

# int x = expr;   (variable declaration with initialiser)
_VAR_DECL = re.compile(r"^(\s*)int\s+(\w+)\s*=\s*(.+?)\s*;\s*$")

# x = expr;   (assignment, not declaration — name must already be declared)
_VAR_ASSIGN = re.compile(r"^(\s*)(\w+)\s*=\s*(.+?)\s*;\s*$")

# int main() {
_MAIN_OPEN = re.compile(r"^\s*int\s+main\s*\(\s*\)\s*\{\s*$")

# return N;
_RETURN_STMT = re.compile(r"^\s*return\s+\d+\s*;\s*$")

# A lone closing brace
_CLOSE_BRACE = re.compile(r"^\s*\}\s*$")


# ---------------------------------------------------------------------------
# Runtime header injected at the top of every instrumented file
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

    The instrumented source:
      - emits exec_start after main() opens
      - emits scope_enter after main() opens
      - emits var_init after each int variable declaration
      - emits var_write after each variable assignment
      - emits scope_exit before main() closes
      - emits exec_end before main() closes

    Variable runtime IDs use the format "name#counter" (e.g. "x#1").
    """

    def instrument(self, source: str) -> str:
        """
        Instrument the source and return the modified source string.

        The caller writes this to a file and compiles it inside the sandbox.
        """
        lines = source.splitlines()
        output: list[str] = [_RUNTIME_HEADER]

        seq = [0]

        def next_seq() -> int:
            seq[0] += 1
            return seq[0]

        # Track declared variables so we can assign runtime IDs
        declared: dict[str, int] = {}   # name -> counter

        def runtime_id(name: str) -> str:
            if name not in declared:
                declared[name] = 1
            return f"{name}#{declared[name]}"

        def emit_line(kind: str, extra_fields: str, indent: str = "    ") -> str:
            """Build a prism_emit(...) statement."""
            s = next_seq()
            return f'{indent}prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"{kind}\\"{extra_fields}}}");'

        in_main = False
        brace_depth = 0

        for line_num, line in enumerate(lines, start=1):
            stripped = line.rstrip()

            # ----------------------------------------------------------------
            # Detect int main() {
            # ----------------------------------------------------------------
            if _MAIN_OPEN.match(stripped):
                output.append(stripped)
                in_main = True
                brace_depth = 1

                # exec_start
                s = next_seq()
                output.append(
                    f'    prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"exec_start\\",'
                    f'\\"line\\":{line_num}}}");'
                )
                # scope_enter
                s = next_seq()
                output.append(
                    f'    prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"scope_enter\\",'
                    f'\\"scope_name\\":\\"main\\",\\"line\\":{line_num}}}");'
                )
                continue

            if not in_main:
                output.append(stripped)
                continue

            # ----------------------------------------------------------------
            # Inside main() — track brace depth
            # ----------------------------------------------------------------
            opens = stripped.count("{")
            closes = stripped.count("}")
            brace_depth += opens - closes

            # ----------------------------------------------------------------
            # Detect closing brace of main()
            # ----------------------------------------------------------------
            if brace_depth <= 0 and _CLOSE_BRACE.match(stripped):
                # scope_exit
                s = next_seq()
                output.append(
                    f'    prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"scope_exit\\",'
                    f'\\"scope_name\\":\\"main\\",\\"line\\":{line_num}}}");'
                )
                # exec_end
                s = next_seq()
                output.append(
                    f'    prism_emit("{{\\"seq\\":{s},\\"kind\\":\\"exec_end\\",'
                    f'\\"line\\":{line_num}}}");'
                )
                output.append(stripped)
                in_main = False
                continue

            # ----------------------------------------------------------------
            # Detect int variable declaration: int x = expr;
            # ----------------------------------------------------------------
            decl_match = _VAR_DECL.match(stripped)
            if decl_match:
                indent = decl_match.group(1) or "    "
                name = decl_match.group(2)
                declared[name] = declared.get(name, 0) + 1 if name not in declared else 1
                declared[name] = 1  # Sprint 0: one instance per name
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
            # Detect variable assignment: x = expr;
            # Must be a variable we have already declared.
            # ----------------------------------------------------------------
            assign_match = _VAR_ASSIGN.match(stripped)
            if assign_match and not decl_match:
                indent = assign_match.group(1) or "    "
                name = assign_match.group(2)
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
            # All other lines pass through unchanged
            # ----------------------------------------------------------------
            output.append(stripped)

        return "\n".join(output) + "\n"