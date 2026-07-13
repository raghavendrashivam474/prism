# # Tracing Strategy Spike - Strategy A: Source Instrumentation

INVESTIGATION NOTES - not production code.

Concept:
    Rewrite supported C++ statements to emit JSON trace lines to stdout.
    Compile the instrumented source inside the sandbox.
    Capture stdout as the raw trace.

Findings:
    - Deterministic for sequential int-only code.
    - Values captured correctly after each assignment completes.
    - Source line numbers embedded at instrumentation time - exact.
    - No debugger or external tooling beyond a C++ compiler.
    - Full control over trace schema.
    - Implementation complexity: LOW for the Sprint 0 profile.
    - Scales poorly for complex C++ - acceptable, out of Sprint 0 scope.

Verdict: Selected for Sprint 0.
