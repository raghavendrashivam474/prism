# Sprint 0 Completion Report

**Date:** Sprint 0
**Sprint Objective:** Prove that a narrow subset of real C++ execution
can be transformed into deterministic, language-neutral Learning IR
through replaceable architectural boundaries.

---

## Definition of Done — Final Status

| Requirement | Status |
|---|---|
| Supported C++ fixture executes through full pipeline | PASS |
| Profile validation occurs before execution | PASS |
| Language adapter resolved through registry | PASS |
| Execution through SandboxProvider contract | PASS |
| C++ raw trace produced | PASS |
| Raw trace contained within C++ adapter boundary | PASS |
| Transformer produces Learning IR v0.1 | PASS |
| Learning IR passes schema validation | PASS |
| Entity IDs are trace-local, not bare names | PASS |
| Source lines retained in learning events | PASS |
| Event order is deterministic | PASS |
| Unsupported loops explicitly rejected | PASS |
| Unsupported pointers explicitly rejected | PASS |
| Compilation failures produce structured output | PASS |
| Docker implementation absent from ExecutionService | PASS |
| Golden integration tests pass | PASS |
| CLI JSON output is machine-readable | PASS |
| Tracing limitations documented | PASS |

---

## Test Results

| Suite | Tests | Result |
|---|---|---|
| Contract tests | 54 | PASS |
| Unit tests (transformer, parser) | 24 | PASS |
| Sandbox tests | 15 | PASS |
| Execution service tests | 14 | PASS |
| Golden integration tests | 18 | PASS |
| **Total** | **125** | **ALL PASS** |

Non-Docker test run (CI-safe): 111 passed.
Docker test run (full): 125 passed.

---

## Pipeline Verified

The following end-to-end result was produced by the real pipeline:

Input:
```cpp
int main() {
    int x = 10;
    x = 20;
    x = x + 5;

    return 0;
}
Output — 7 Learning IR events:

execution.started
scope.entered (main)
entity.created (x : int = 10)
entity.value_changed (10 -> 20)
entity.value_changed (20 -> 25)
scope.exited (main)
execution.completed
Entity ID: var_x_1 (trace-local, not bare "x")
Source lines: retained on each event
Sequence: 1-based, contiguous, deterministic

Tracing Strategy Selected
Strategy A — Source Instrumentation.

The instrumentor rewrites supported C++ source to emit JSON trace lines
to stdout. The Docker sandbox compiles and executes the instrumented
binary. Raw JSON lines are parsed into RawCppEvent objects and
transformed into Learning IR by CppTraceTransformer.

This strategy is fully contained within the C++ adapter boundary.

Issues Discovered and Resolved During Sprint 0
Windows CRLF line endings in Docker workspace

Cause: PowerShell writes CRLF by default; Linux bash rejects CRLF scripts
Fix: DockerSandboxProvider normalises all files to LF before writing
Status: Resolved
scope_exit and exec_end emitted after return (unreachable)

Cause: Instrumentor inserted emit calls after return statement
Fix: Instrumentor now intercepts return statement and emits
scope_exit and exec_end before it
Status: Resolved
pyproject.toml BOM encoding error

Cause: PowerShell Set-Content writes UTF-8 BOM; TOML parser rejects it
Fix: All file writes use System.IO.File.WriteAllText with UTF8NoBOM encoding
Status: Resolved, Write-Utf8 helper established for all file writes
Sprint 0 Decision
GO WITH LIMITATIONS

Justification
The core technical question is answered affirmatively:

A narrow piece of real C++ execution was reliably converted into
deterministic, language-neutral learning events through replaceable
architectural boundaries.

The pipeline is proven end-to-end:

Real C++ compiles and executes inside an isolated Docker container
Trace events are deterministic across multiple runs
Learning IR passes schema validation on every execution
Unsupported code is explicitly rejected before compilation
The C++ adapter is replaceable without modifying PRISM Core
The sandbox is replaceable without modifying language adapters
The primary limitation — source instrumentation does not scale to full
C++ — is acceptable because:

The profile validator prevents unsupported code from reaching the instrumentor
The C++ adapter boundary allows the tracing strategy to be replaced
Strategy C (Clang AST tooling) is the recommended Sprint 1 upgrade path
Recommended Sprint 1 Actions
Expand profile: user-defined functions with int parameters
Upgrade validator to use libclang for structural validation
Introduce scope nesting in Learning IR and transformer
Define Learning IR v0.2 with column-level source locations
Evaluate container warm-up strategy to reduce execution latency
Begin frontend spike: consume Learning IR and render variable state