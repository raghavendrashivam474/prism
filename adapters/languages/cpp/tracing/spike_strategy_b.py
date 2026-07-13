# # Tracing Strategy Spike - Strategy B: Debugger-Based Tracing

INVESTIGATION NOTES - not production code.

Concept:
    Compile with debug symbols (-g).
    Automate GDB MI or LLDB Python API to step through execution.
    Read variable values at each statement boundary.

Findings:
    - Technically feasible.
    - GDB MI automatable but requires a dedicated output parser.
    - LLDB Python bindings require specific installation.
    - Debugger startup adds latency on every execution.
    - No benefit over Strategy A for the Sprint 0 profile.
    - Implementation complexity: HIGH.

Future value:
    Better suited for pointer/reference/heap observation.
    Viable upgrade path if Strategy A proves insufficient.

Verdict: Not selected for Sprint 0.
