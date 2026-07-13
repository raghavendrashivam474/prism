# C++ Runtime Tracing Strategy Evaluation
**Sprint:** Sprint 0
**Date:** Sprint 0

## Objective

Determine the most appropriate C++ runtime tracing strategy for reliably
producing Learning IR from the Sprint 0 supported profile without a local
C++ compiler. The compiler runs inside a Docker container.

## Strategies Evaluated

### Strategy A - Source Instrumentation

Transform supported C++ statements into trace-emitting equivalents,
compile inside the Docker sandbox, and capture structured JSON from stdout.

Prototype transformation - original source:
    int x = 10;
    x = 20;
    x = x + 5;

After instrumentation, the binary emits JSON lines to stdout:
    {"seq":1,"kind":"var_init","name":"x","value":10,"line":2}
    {"seq":2,"kind":"var_write","name":"x","value":20,"line":3}
    {"seq":3,"kind":"var_write","name":"x","value":25,"line":4}

Implementation complexity: Low
Correctness for Sprint 0 profile: High
Source mapping quality: Exact (line embedded at instrumentation time)
External dependencies: C++ compiler only (inside Docker)
Extensibility: Limited for templates or complex macros

### Strategy B - Debugger-Based Tracing (GDB/LLDB)

Compile with debug symbols. Automate GDB MI or LLDB Python API to step
through execution and read variable state at each statement boundary.

Implementation complexity: High
Correctness for Sprint 0 profile: Medium (automation fragility)
Source mapping quality: Good (debug symbols provide line info)
External dependencies: GDB or LLDB must be installed in the sandbox
Extensibility: Good for pointer/heap observation in future sprints

### Strategy C - Clang AST Tooling

Use libclang Python bindings to parse C++ into an AST, identify variable
declarations and assignments, inject trace hooks at correct positions.

Implementation complexity: Very High
Correctness for Sprint 0 profile: Highest
Source mapping quality: Exact (AST-level node locations)
External dependencies: Native Clang + libclang Python bindings
Extensibility: Excellent

## Comparison

| Criterion              | Strategy A   | Strategy B    | Strategy C   |
|------------------------|--------------|---------------|--------------|
| Implementation cost    | Low          | High          | Very High    |
| Sprint 0 correctness   | High         | Medium        | Highest      |
| Determinism            | High         | Medium        | High         |
| Source mapping         | Exact        | Good          | Exact        |
| External dependencies  | Compiler     | Debugger      | Clang + libs |
| Sprint 0 suitability   | Recommended  | -             | -            |
| Future extensibility   | Limited      | Good          | Excellent    |

## Sprint 0 Recommendation

Selected: Strategy A - Source Instrumentation

The Sprint 0 profile is deliberately narrow: sequential int-only code,
no pointers, no loops, no user functions. Within this profile, source
instrumentation is reliable, deterministic, and straightforward.

Strategy A produces exact source-line mapping by embedding line numbers
at instrumentation time. Values are captured after assignment completes,
which is correct for all supported statement types.

Strategy B introduces debugger automation complexity with no benefit for
the current profile. Strategy C is the architecturally correct long-term
path but is not justified for a feasibility-proof sprint.

The instrumentation implementation is fully contained within the C++
adapter boundary. The adapter can be replaced with Strategy B or C in
Sprint 1+ without modifying PRISM Core or Learning IR.

## Known Limitations of Strategy A

1. Source rewriting must correctly handle all supported arithmetic forms.
2. Complex expressions are unsupported and rejected by the validator.
3. Instrumented source is never shown to the learner.
4. Template and macro support would require a different strategy.
5. Column-level source precision is not available - line level only.

## Environment Note

No local C++ compiler is available on the development machine.
The compiler runs inside the Docker sandbox (gcc:13 image).
Strategy A is compatible with this constraint.
