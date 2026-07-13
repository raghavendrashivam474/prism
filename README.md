# PRISM

**Programming Interactive State Machine**

> **Make program execution visible, deterministic, and understandable.**

PRISM is an interactive programming-learning platform designed to transform real program execution into structured, language-neutral learning events.

Instead of treating code as static syntax, PRISM aims to expose how program state changes over time.

A simple C++ program such as:

```cpp
int main() {
    int x = 10;
    x = 20;
    x = x + 5;

    return 0;
}
```

can be represented semantically as:

```text
execution started
        ↓
main scope entered
        ↓
x created with value 10
        ↓
x changed from 10 to 20
        ↓
x changed from 20 to 25
        ↓
main scope exited
        ↓
execution completed
```

This execution model forms the technical foundation for future PRISM capabilities such as step-by-step execution timelines, variable-state visualisation, scope and lifetime visualisation, pointer relationships, interactive lessons, misconception detection, and targeted learning interventions.

---

# Project Vision

Programming concepts are often difficult for beginners because many important behaviours are invisible.

Examples include:

* variable state changes
* scope and lifetime
* function call boundaries
* references
* pointers
* stack frames
* heap objects
* execution flow

Traditional programming education frequently explains these behaviours using static text, diagrams, or final program output.

PRISM is being designed around a different learning model:

```text
SEE
 ↓
TOUCH
 ↓
CHANGE
 ↓
BREAK
 ↓
TRACE
 ↓
UNDERSTAND
 ↓
BUILD
```

The long-term goal is not merely to create another C++ course or online compiler.

PRISM aims to become a programming concept interaction system in which real program execution can be transformed into visual and manipulable learning experiences.

C++ is the first language used to validate this architecture.

---

# Current Project Status

## Sprint 0 — Architecture & C++ Trace Feasibility

**Status:** Complete
**Decision:** **GO WITH LIMITATIONS**

Sprint 0 was a technical kill-test rather than a user-facing feature sprint.

The central technical question was:

> Can PRISM obtain useful runtime observations from a deliberately narrow C++ subset and transform those observations into deterministic, language-neutral Learning IR?

The answer is:

> **Yes, within explicitly defined constraints.**

PRISM can currently:

* validate source against a supported C++ trace profile
* prepare supported C++ source for tracing
* compile real C++ inside an isolated Docker container
* execute the compiled program
* capture deterministic runtime trace events
* parse language-specific raw C++ trace data
* transform raw trace data into Learning IR v0.1
* validate the resulting Learning IR using typed schemas
* preserve source line mappings
* generate stable trace-local entity identities
* reject unsupported source before execution
* return structured execution failures
* expose the complete pipeline through a command-line interface

The complete Sprint 0 technical decision is documented in:

```text
docs/sprint-0/completion-report.md
```

---

# Sprint 0 Architecture

The current execution pipeline is:

```text
C++ SOURCE
    │
    ▼
EXECUTION REQUEST
    │
    ▼
EXECUTION SERVICE
    │
    ▼
LANGUAGE ADAPTER REGISTRY
    │
    ▼
C++ LANGUAGE ADAPTER
    │
    ├── PROFILE VALIDATION
    │
    ├── SOURCE INSTRUMENTATION
    │
    └── WORKLOAD PREPARATION
    │
    ▼
SANDBOX PROVIDER
    │
    ▼
DOCKER SANDBOX PROVIDER
    │
    ├── TEMPORARY WORKSPACE
    ├── NETWORK DISABLED
    ├── C++ COMPILATION
    ├── PROGRAM EXECUTION
    └── OUTPUT CAPTURE
    │
    ▼
RAW C++ TRACE
    │
    ▼
C++ TRACE TRANSFORMER
    │
    ▼
LEARNING IR v0.1
    │
    ▼
LEARNING TRACE
```

The execution application depends only on contracts.

Conceptually:

```text
ExecutionService
    │
    ├── LanguageAdapterRegistry
    │       └── CppLanguageAdapter
    │
    └── SandboxProvider
            └── DockerSandboxProvider
```

`ExecutionService` has no direct knowledge of:

* Docker
* subprocess execution
* Clang
* GCC
* GDB
* LLDB
* source instrumentation
* raw C++ trace formats

This allows tracing and sandbox implementations to evolve independently.

For the complete architecture document, see:

```text
docs/architecture/sprint-0-architecture.md
```

---

# Core Architecture Principle

PRISM follows a contract-first modular architecture.

> **PRISM Core depends on contracts, never concrete infrastructure implementations.**

Forbidden relationship:

```text
ExecutionService
        ↓
Docker
```

Required relationship:

```text
ExecutionService
        ↓
SandboxProvider
        ↓
DockerSandboxProvider
```

The same principle applies to language execution.

```text
ExecutionService
        ↓
LanguageAdapter
        ↓
CppLanguageAdapter
        ↓
C++ tracing implementation
```

The current C++ tracing implementation can therefore be replaced without changing the execution application.

The current Docker sandbox can also be replaced without changing language adapters or PRISM Core.

---

# Learning IR

Learning IR is PRISM's language-neutral execution representation.

It forms the stable boundary between language-specific program execution and future learning systems.

Example event:

```json
{
  "irVersion": "0.1",
  "sequence": 3,
  "type": "entity.created",
  "source": {
    "line": 2
  },
  "entityId": "var_x_1",
  "payload": {
    "kind": "variable",
    "displayName": "x",
    "dataType": "int",
    "value": 10,
    "scopeId": "scope_main_1"
  }
}
```

A value change is represented as:

```json
{
  "irVersion": "0.1",
  "sequence": 4,
  "type": "entity.value_changed",
  "source": {
    "line": 3
  },
  "entityId": "var_x_1",
  "payload": {
    "previousValue": 10,
    "value": 20
  }
}
```

Sprint 0 supports the following Learning IR event types:

```text
execution.started
scope.entered
entity.created
entity.value_changed
scope.exited
execution.completed
execution.failed
```

## Entity Identity

Display names are not treated as entity identities.

For example:

```text
x
```

is a display name.

The trace-local identity is:

```text
var_x_1
```

This distinction prepares the architecture for future concepts such as variable shadowing and nested scopes.

## Sequence Validation

Learning IR events must form a contiguous, one-based sequence.

Valid:

```text
1
2
3
4
5
```

Invalid:

```text
1
2
4
5
```

Gaps, duplicates, and out-of-order event sequences are rejected by the Learning IR schema.

---

# Supported C++ Trace Profile v0.1

Sprint 0 deliberately supports a narrow C++ subset.

## Supported

* `main()` function
* local `int` variables
* integer literal initialisation
* direct variable assignment
* arithmetic assignment
* addition using `+`
* subtraction using `-`
* multiplication using `*`
* division using `/`
* sequential execution
* normal completion using `return 0`

Examples:

```cpp
int x = 10;
```

```cpp
x = 20;
```

```cpp
x = x + 5;
```

```cpp
int y = x * 2;
```

## Explicitly Unsupported

* pointers
* references
* arrays
* vectors
* strings
* non-`int` primitive types
* loops
* conditionals
* user-defined functions
* recursion
* classes
* structs
* templates
* macros requiring semantic expansion
* exceptions
* lambdas
* threads
* heap allocation
* STL visualisation

Unsupported code is rejected before compilation.

Example:

```json
{
  "supported": false,
  "violations": [
    {
      "code": "CPP_PROFILE_LOOP_UNSUPPORTED",
      "line": 3,
      "message": "Loops (for/while/do) are not supported by C++ Trace Profile v0.1."
    }
  ]
}
```

PRISM does not silently generate partial or misleading Learning IR for unsupported programs.

For the complete profile specification, see:

```text
docs/sprint-0/supported-cpp-profile.md
```

---

# C++ Tracing Strategy

Sprint 0 evaluated three tracing approaches.

| Strategy               | Complexity | Correctness Potential      | Sprint 0 Suitability |
| ---------------------- | ---------- | -------------------------- | -------------------- |
| Source instrumentation | Low        | High within narrow profile | Selected             |
| GDB / LLDB tracing     | High       | Medium to high             | Not selected         |
| Clang AST tooling      | Very high  | Highest                    | Future candidate     |

## Current Strategy

PRISM currently uses source instrumentation.

Conceptually:

```cpp
int x = 10;
```

is transformed into:

```cpp
int x = 10;
prism_emit(...);
```

Likewise:

```cpp
x = 20;
```

becomes:

```cpp
x = 20;
prism_emit(...);
```

The emitted trace data is captured during real program execution.

This produces a language-specific raw C++ trace.

```text
REAL C++ EXECUTION
        ↓
RAW C++ TRACE
        ↓
CPP TRACE TRANSFORMER
        ↓
LEARNING IR
```

Raw C++ trace types remain fully contained inside the C++ language adapter.

PRISM Core never consumes raw C++ events.

The source instrumentation strategy is considered suitable for the current trace profile but is not expected to scale cleanly to complex C++.

A future C++ adapter may use Clang AST tooling or compiler-level instrumentation while continuing to emit the same Learning IR contract.

See:

```text
docs/sprint-0/tracing-strategy-evaluation.md
```

---

# Repository Structure

```text
prism/
│
├── apps/
│   └── trace_cli/
│
├── contracts/
│   ├── language/
│   ├── learning_ir/
│   └── sandbox/
│
├── core/
│   └── execution/
│
├── adapters/
│   ├── languages/
│   │   └── cpp/
│   │       ├── instrumentation/
│   │       ├── tracing/
│   │       └── transformer/
│   │
│   └── sandboxes/
│       ├── docker/
│       └── local/
│
├── fixtures/
│   └── cpp/
│
├── tests/
│   ├── contract/
│   ├── integration/
│   └── golden/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   └── sprint-0/
│
├── scripts/
│
├── .gitignore
├── README.md
└── LICENSE
```

---

# Quick Start

## Prerequisites

Install:

* Python 3.12 or newer
* Docker Desktop

Docker Desktop must be running when using the Docker sandbox or running integration tests.

## Clone the Repository

```powershell
git clone <repository-url>
cd prism
```

## Create a Virtual Environment

```powershell
python -m venv .venv
```

Activate it:

```powershell
.venv\Scripts\Activate.ps1
```

## Install Dependencies

```powershell
pip install -e ".[dev]"
```

---

# Using the Trace CLI

Run a supported C++ fixture through the Docker execution pipeline:

```powershell
python -m apps.trace_cli fixtures/cpp/variable_arithmetic.cpp --sandbox docker
```

Expected semantic output:

```text
PRISM Trace CLI
Language: cpp
Profile: cpp-trace-v0.1

Validating source...
SUPPORTED

Preparing execution...
Compiling...
Executing...
Transforming trace...

Learning IR generated successfully.

[1] execution.started

[2] scope.entered
    main

[3] entity.created
    x : int = 10

[4] entity.value_changed
    x
    10 -> 20

[5] entity.value_changed
    x
    20 -> 25

[6] scope.exited
    main

[7] execution.completed
```

## JSON Output

Use the `--json` flag to produce machine-readable Learning IR:

```powershell
python -m apps.trace_cli fixtures/cpp/variable_arithmetic.cpp --sandbox docker --json
```

JSON data is written to stdout.

Diagnostic output is written to stderr.

This allows future applications to consume CLI output programmatically.

---

# Running Tests

## Full Test Suite

Docker Desktop must be running.

```powershell
pytest tests/ -v
```

Sprint 0 final result:

```text
125 passed
```

## CI-Safe Test Suite

Run all tests that do not require Docker:

```powershell
pytest tests/ -v -m "not integration"
```

Sprint 0 final result:

```text
111 passed
```

---

# Sprint 0 Test Results

| Suite                    |   Tests |
| ------------------------ | ------: |
| Contract tests           |      54 |
| Transformer unit tests   |      24 |
| Sandbox tests            |      15 |
| Execution service tests  |      14 |
| Golden integration tests |      18 |
| **Total**                | **125** |

The test suite verifies:

* schema validation
* Learning IR sequence rules
* entity identity requirements
* language adapter registration
* sandbox protocol conformance
* C++ profile validation
* raw trace parsing
* raw trace transformation
* previous-value tracking
* execution orchestration
* architectural boundaries
* Docker command construction
* complete fixture-to-IR behaviour
* deterministic Learning IR output

Golden integration tests execute real C++ through the complete Docker pipeline and compare the resulting Learning IR against committed expected JSON files.

---

# Structured Failure Model

PRISM does not expose arbitrary execution errors as its application contract.

Current failure categories include:

```text
unsupported_profile
compilation_failed
execution_timed_out
execution_failed
trace_invalid
internal_error
```

Example:

```json
{
  "type": "execution.failed",
  "payload": {
    "category": "compilation_failed",
    "message": "C++ compilation failed.",
    "diagnostics": []
  }
}
```

Raw compiler output may be retained for diagnostics, but compiler text does not define PRISM's stable error contract.

---

# Known Limitations

Sprint 0 completed with a **GO WITH LIMITATIONS** decision.

The current known limitations are:

| Limitation                                           | Current Impact                       | Future Direction                            |
| ---------------------------------------------------- | ------------------------------------ | ------------------------------------------- |
| Source instrumentation does not scale to complex C++ | Bounded by profile validator         | Clang AST or compiler-level instrumentation |
| Profile validator is regex-based                     | Acceptable for narrow profile        | Structural validation using Clang           |
| Single return path assumed                           | Multiple returns unsupported         | Instrument all return paths                 |
| Source mapping is line-level                         | No column-level highlighting         | AST-derived source locations                |
| Docker cold start takes approximately 2–5 seconds    | Noticeable for interactive execution | Warm execution workers or container pooling |
| Local sandbox provides no isolation                  | Development use only                 | Docker required for untrusted execution     |
| Learning IR migration strategy is undefined          | No current migration required        | Define before Learning IR v0.2              |

See:

```text
docs/sprint-0/known-limitations.md
```

---

# Sprint 0 Issues Discovered

Sprint 0 surfaced two real integration problems.

## Windows CRLF in Docker Workspaces

PowerShell-generated CRLF line endings caused Linux shell scripts inside the Docker container to fail.

The Docker sandbox now normalises workspace file content to LF before writing files.

This fix is implemented at the infrastructure adapter boundary.

Language adapters remain unaware of host operating-system line endings.

## Trace Events After `return`

Initial instrumentation inserted scope-exit and execution-completion events after:

```cpp
return 0;
```

Those trace calls were unreachable.

The instrumentor now emits:

```text
scope.exited
execution.completed
```

before the return statement.

This guarantees the expected normal-completion event sequence for C++ Trace Profile v0.1.

---

# Architecture Decision Records

Sprint 0 introduced three architecture decision records.

## ADR-0001 — Contract-First Modular Architecture

PRISM Core depends on abstractions rather than concrete language or infrastructure implementations.

## ADR-0002 — Learning IR Boundary

Language adapters must transform language-specific execution data into Learning IR before returning results to PRISM Core.

## ADR-0003 — C++ Trace Profile v0.1

PRISM initially supports a deliberately narrow subset of C++ to validate deterministic runtime tracing.

The ADRs are available in:

```text
docs/adr/
```

---

# Sprint 0 Final Verification

All Sprint 0 definition-of-done requirements passed.

Key verified properties:

* real C++ executes through the full pipeline
* profile validation occurs before compilation
* language adapters resolve through a registry
* execution occurs through the SandboxProvider contract
* C++ runtime tracing produces structured raw events
* raw C++ trace data remains inside the C++ adapter
* Learning IR v0.1 is schema validated
* event sequences are deterministic
* source line numbers are retained
* entity identities are trace-local
* unsupported loops are explicitly rejected
* unsupported pointers are explicitly rejected
* compilation failures are structured
* Docker implementation details remain outside execution business logic
* golden integration tests pass
* CLI JSON output is machine-readable
* tracing limitations are documented

---

# Sprint 0 Final Numbers

| Metric                                     |  Result |
| ------------------------------------------ | ------: |
| Milestones completed                       | 12 / 12 |
| Commits                                    |      14 |
| Python source files                        |      22 |
| Test files                                 |       6 |
| Tests                                      |     125 |
| C++ fixtures                               |       8 |
| Golden IR files                            |       4 |
| ADRs                                       |       3 |
| Documentation files                        |       6 |
| Approximate lines of code                  |   2,400 |
| Real integration bugs discovered and fixed |       2 |

**Sprint 0 Decision: GO WITH LIMITATIONS**

---

# Next Direction

Sprint 0 proved the producer side of PRISM's execution architecture.

The next technical question is:

> Can Learning IR be consumed cleanly by a visual state system and transformed into an understandable step-by-step programming experience?

The immediate direction is therefore:

```text
LEARNING IR
      ↓
VISUAL STATE ENGINE
      ↓
STATE SNAPSHOTS
      ↓
TIMELINE CONTROLLER
      │
      ├── SOURCE HIGHLIGHT
      │
      └── VARIABLE VISUALISER
```

Sprint 1 should validate the consumer side before significantly expanding the supported C++ profile.

The objective is not simply to render execution data.

The objective is to determine whether PRISM can make program state changes easier to understand than conventional code tracing.

---

# Long-Term Direction

PRISM is being architected so language implementations, sandbox providers, visual systems, interaction types, and future learning analyzers can evolve independently.

Conceptually:

```text
C++ ──────────┐
Python ───────┤
Rust ─────────┼──> LEARNING IR ──> VISUAL STATE ENGINE
JavaScript ───┤                         │
Java ─────────┘                         ▼
                                  LEARNING EXPERIENCE
```

The long-term goal is to move beyond static programming instruction and create learning experiences where learners can observe, manipulate, predict, break, and understand program behaviour.

> **PRISM turns program execution into a learning medium.**

---

## License

See `LICENSE` for licensing information.
