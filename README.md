# PRISM

**Programming Interactive State Machine**

> **Make program execution visible, deterministic, and understandable.**

PRISM is an interactive programming-learning platform that transforms real program execution into deterministic, language-neutral learning events and projects those events as a synchronised, step-by-step visual execution experience.

Instead of treating code as static syntax or reducing execution to final console output, PRISM exposes how program state changes over time.

A supported C++ program such as:

```cpp
int main() {
    int x = 10;
    x = 20;
    x = x + 5;

    return 0;
}
```

is executed as real C++ and transformed into semantic learning events:

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

PRISM then reconstructs immutable program-state snapshots from those events.

A learner can move forwards and backwards through execution while the source highlight, variable state, and human-readable step description remain synchronised.

The C++ program is not re-executed during timeline navigation.

---

# Project Vision

Programming concepts are often difficult because important runtime behaviours are invisible.

Examples include:

* variable state changes
* scope and lifetime
* function call boundaries
* references
* pointers
* stack frames
* heap objects
* ownership
* asynchronous execution flow

Traditional programming education frequently explains these behaviours through static text, diagrams, or final program output.

PRISM is designed around a different learning model:

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

The long-term goal is not to create another C++ course or online compiler.

PRISM aims to become a programming concept interaction system where real program execution can be transformed into visual, navigable, and eventually interactive learning experiences.

C++ is the first language used to validate the architecture.

---

# Current Status

## Sprint 0 — Architecture & C++ Trace Feasibility

**Decision:** `GO WITH LIMITATIONS`

Sprint 0 proved the producer side of PRISM:

```text
REAL C++
    ↓
PROFILE VALIDATION
    ↓
LANGUAGE ADAPTER
    ↓
ISOLATED EXECUTION
    ↓
RAW LANGUAGE TRACE
    ↓
TRACE TRANSFORMATION
    ↓
LEARNING IR v0.1
```

PRISM demonstrated that a deliberately narrow subset of real C++ execution can be transformed into deterministic, schema-validated, language-neutral Learning IR events.

Sprint 0 was released as:

```text
v0.1.0
```

See:

```text
docs/sprint-0/completion-report.md
```

---

## Sprint 1 — Visual Execution Core

**Decision:** `GO`

Sprint 1 proved the consumer side of PRISM:

```text
LEARNING IR v0.1
        ↓
TRACE INGESTION
        ↓
NORMALISED TRACE
        ↓
VISUAL STATE ENGINE
        ↓
IMMUTABLE STATE SNAPSHOTS
        ↓
SNAPSHOT TIMELINE
        ↓
CURRENT SNAPSHOT
        ├── SOURCE HIGHLIGHT
        ├── VARIABLE VISUALISATION
        └── STEP DESCRIPTION
```

A learner can now:

* write supported C++ in the browser
* execute the source through the real Sprint 0 pipeline
* receive Learning IR v0.1
* navigate execution forwards
* navigate execution backwards
* observe variable creation
* observe variable value changes
* see the active source line
* read a deterministic human description of the current execution event

Every visual projection derives from one execution-state authority:

```text
currentSnapshot
```

There is no independent active-line state, variable-step state, or description-step state.

Moving the timeline once updates every execution projection together.

Sprint 1 is the first complete browser-based PRISM execution experience.

See:

```text
docs/sprint-1/completion-report.md
```

---

# Project Validation Status

| Sprint   | Validation Question                                                                 | Decision                |
| -------- | ----------------------------------------------------------------------------------- | ----------------------- |
| Sprint 0 | Can real C++ execution become deterministic, language-neutral Learning IR?          | **GO WITH LIMITATIONS** |
| Sprint 1 | Can Learning IR become an understandable, synchronised visual execution experience? | **GO**                  |

Current automated test result:

```text
234 tests passing
```

Test composition:

| Runtime    |   Tests |
| ---------- | ------: |
| Python     |     138 |
| TypeScript |      96 |
| **Total**  | **234** |

Execution modes:

```text
CI-safe, no Docker required: 220 tests
Full run with Docker:        234 tests
```

---

# Architecture

The current end-to-end architecture is:

```text
                              LEARNER
                                 │
                                 ▼
                         NEXT.JS WORKSPACE
                            apps/web
                                 │
                                 ▼
                            useWorkspace
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
           CODE WORKSPACE                   RUN CONTROL
              MONACO                             │
                                                 ▼
                                      HttpExecutionClient
                                                 │
                                            HTTP BOUNDARY
                                                 │
                                                 ▼
                                           FASTAPI API
                                            apps/api
                                                 │
                                                 ▼
                                         ExecutionService
                                             SPRINT 0
                                                 │
                          ┌──────────────────────┴──────────────────────┐
                          ▼                                             ▼
               LanguageAdapterRegistry                         SandboxProvider
                          │                                             │
                          ▼                                             ▼
               CppLanguageAdapter                         DockerSandboxProvider
                          │                                             │
                          └──────────────────────┬──────────────────────┘
                                                 ▼
                                          REAL C++ EXECUTION
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
                                            HTTP RESPONSE
                                                 │
                                                 ▼
                                    LearningIrV01Ingestor
                                                 │
                                                 ▼
                                         NormalizedTrace
                                                 │
                                                 ▼
                                  DefaultVisualStateEngine
                                                 │
                                                 ▼
                                  VisualStateSnapshot[]
                                           IMMUTABLE
                                                 │
                                                 ▼
                               SnapshotTimelineController
                                                 │
                                                 ▼
                                         currentSnapshot
                                                 │
                       ┌─────────────────────────┼─────────────────────────┐
                       ▼                         ▼                         ▼
               SOURCE PROJECTION       VARIABLE VISUALISER          STEP DESCRIBER
                       │                         │                         │
                       ▼                         ▼                         ▼
                MONACO HIGHLIGHT           VariablePanel           HUMAN DESCRIPTION
```

The architectural rule is:

> **One current snapshot drives every visual execution element on screen.**

---

# Core Architecture Principles

## Contract-First Execution

PRISM Core depends on contracts rather than concrete infrastructure.

Required relationship:

```text
ExecutionService
        ↓
LanguageAdapter
        ↓
CppLanguageAdapter
```

and:

```text
ExecutionService
        ↓
SandboxProvider
        ↓
DockerSandboxProvider
```

`ExecutionService` has no direct knowledge of:

* Docker
* subprocess orchestration
* GCC
* Clang
* GDB
* LLDB
* source instrumentation internals

This allows language tracing and execution infrastructure to evolve independently.

---

## Learning IR as the Execution Boundary

Language-specific runtime information must be transformed into Learning IR before leaving the language adapter boundary.

```text
C++ EXECUTION
      ↓
RAW C++ TRACE
      ↓
CPP TRACE TRANSFORMER
      ↓
LEARNING IR
      ↓
PRISM CONSUMERS
```

Frontend systems never receive raw C++ trace events.

Learning IR represents execution facts.

It does not contain:

* React component names
* visual colours
* card layouts
* animation instructions
* editor concepts

Visual systems decide how execution facts should be represented.

---

## Pure Consumer Domain Packages

Frontend execution logic lives in pure TypeScript packages.

```text
packages/
├── trace-model/
├── visual-state-engine/
├── timeline/
└── visualizers/
    └── variable-state/
```

These packages do not depend on:

* React
* Next.js
* Monaco
* HTTP
* CSS
* browser APIs

React components consume domain render models.

They do not implement execution semantics.

Conceptually:

```text
EXECUTION SEMANTICS
        ↓
PURE TYPESCRIPT DOMAIN PACKAGE
        ↓
RENDER MODEL
        ↓
REACT COMPONENT
```

This keeps execution behaviour independently testable and allows future visual projections to reuse the same domain logic.

---

## Snapshot-Based Timeline Navigation

PRISM does not reverse execution events.

Instead:

```text
TRACE EVENTS
      ↓
BUILD SNAPSHOTS ONCE
      ↓
SNAPSHOT 1
SNAPSHOT 2
SNAPSHOT 3
SNAPSHOT 4
...
      ↓
SELECT SNAPSHOT BY INDEX
```

Navigation is snapshot selection.

```text
NEXT
 ↓
snapshot[index + 1]

PREVIOUS
 ↓
snapshot[index - 1]
```

The C++ program is never re-executed during timeline navigation.

Reverse-event logic does not exist.

Snapshots are immutable and frozen at the state-engine level.

This decision is documented in:

```text
docs/adr/ADR-0004-snapshot-based-timeline-navigation.md
```

---

# Learning IR v0.1

Learning IR is PRISM's language-neutral execution representation.

Example entity creation:

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

Example value change:

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

Current Learning IR v0.1 event types include:

```text
execution.started
scope.entered
entity.created
entity.value_changed
scope.exited
execution.completed
execution.failed
```

Event sequences must be contiguous and one-based.

Entity identities are trace-local stable identifiers.

For example:

```text
display name: x
entity ID:    var_x_1
```

The distinction prepares PRISM for future state semantics such as variable shadowing and nested scopes.

---

# Visual State Engine

The Visual State Engine is the core consumer-side execution model.

Input:

```text
NormalizedTrace
```

Output:

```text
VisualStateSnapshot[]
```

Conceptually:

```text
INITIAL STATE
{}

execution.started
        ↓
STATE 1
execution = running

scope.entered(main)
        ↓
STATE 2
active scopes = [main]

entity.created(x, 10)
        ↓
STATE 3
x = 10

entity.value_changed(x, 20)
        ↓
STATE 4
x = 20

entity.value_changed(x, 25)
        ↓
STATE 5
x = 25
```

Every processed event creates one immutable snapshot.

Earlier snapshots cannot be changed by later execution events.

This allows deterministic time navigation without program replay.

---

# Current Snapshot Synchronisation

The timeline exposes one active execution snapshot:

```text
currentSnapshot
```

Every visual projection consumes it.

```text
currentSnapshot
      │
      ├── event.sourceLocation.line
      │          ↓
      │    MONACO HIGHLIGHT
      │
      ├── state
      │     ↓
      │ VARIABLE VISUALISER
      │     ↓
      │ VARIABLE PANEL
      │
      └── event + state
              ↓
        STEP DESCRIBER
              ↓
       HUMAN DESCRIPTION
```

The frontend does not maintain:

```text
activeLineStep
variablePanelStep
descriptionStep
```

The current snapshot is the single execution-step authority.

---

# Variable State Visualiser

Sprint 1 introduced PRISM's first execution visualiser.

The variable visualiser consumes a `VisualStateSnapshot`.

It does not consume:

* C++ source
* raw Learning IR JSON
* raw C++ trace data

The visualiser builds a render model describing variables as:

```text
created
changed
unchanged
```

Example:

```text
VARIABLES

┌──────────────────────────┐
│ x                        │
│ int                      │
│                          │
│        10  →  20         │
│                          │
│ changed                  │
└──────────────────────────┘
```

A later snapshot may show:

```text
VARIABLES

┌──────────────────────────┐
│ x                        │
│ int                      │
│                          │
│        20  →  25         │
│                          │
│ changed                  │
└──────────────────────────┘
```

The visualiser plugin boundary allows new representations of supported visual-state semantics to be added without coupling them to C++.

New execution semantics may still require deliberate Learning IR, trace-model, or Visual State Engine evolution before a corresponding visualiser can be implemented.

---

# Deterministic Step Descriptions

PRISM currently generates human-readable descriptions from execution semantics.

No AI is used.

Examples:

```text
execution.started
→ Program execution started.

scope.entered
→ Execution entered main.

entity.created
→ x was created with value 10.

entity.value_changed
→ x changed from 10 to 20.

scope.exited
→ Execution left main.

execution.completed
→ Program execution completed.
```

Learning IR contains execution facts.

The learning projection creates user-facing descriptions.

This preserves the separation:

```text
EXECUTION FACT
      ↓
LEARNING PROJECTION
      ↓
HUMAN DESCRIPTION
```

---

# Supported C++ Trace Profile v0.1

PRISM currently supports a deliberately narrow C++ subset.

## Supported

* `main()` function only
* local `int` variables
* integer literal initialisation
* direct assignment
* arithmetic using `+`
* arithmetic using `-`
* arithmetic using `*`
* arithmetic using `/`
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
* exceptions
* lambdas
* threads
* heap allocation
* STL visualisation

Unsupported source is rejected before compilation.

See:

```text
docs/sprint-0/supported-cpp-profile.md
```

---

# Repository Structure

```text
prism/
│
├── apps/
│   ├── trace_cli/
│   ├── api/
│   └── web/
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
├── packages/
│   ├── trace-model/
│   ├── visual-state-engine/
│   ├── timeline/
│   └── visualizers/
│       └── variable-state/
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
│   ├── sprint-0/
│   └── sprint-1/
│
├── README.md
└── LICENSE
```

---

# Quick Start

## Prerequisites

Install:

* Python 3.12 or newer
* Node.js 18 or newer
* Docker Desktop

Docker Desktop must be running for real C++ execution and Docker integration tests.

---

## Python Environment

Create a virtual environment:

```powershell
python -m venv .venv
```

Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install Python dependencies:

```powershell
pip install -e ".[dev]"
```

---

## Node Dependencies

From the repository root:

```powershell
npm install
```

---

# Run PRISM

PRISM currently uses separate development processes for the API and web application.

## Terminal 1 — API

From the API app directory:

```powershell
cd apps/api
python -m uvicorn main:app --reload --port 8000
```

The API runs on port `8000`.

> **Windows note:** launch from `apps/api/` with `main:app`, not from the
> repository root with `apps.api.main:app`. Some Windows dev setups
> resolve the Docker sandbox provider inconsistently under the
> package-style module path, leading to intermittent "Access is denied"
> errors from Docker Desktop. The directory-scoped invocation is
> canonical for local dev.

## Terminal 2 — Web

```powershell
cd apps/web
npm run dev
```

Open the local PRISM workspace in the browser:

```text
http://localhost:3000
```

---

# Trace CLI

The Sprint 0 CLI remains available for direct execution-pipeline testing.

```powershell
python -m apps.trace_cli fixtures/cpp/variable_arithmetic.cpp --sandbox docker
```

For machine-readable Learning IR:

```powershell
python -m apps.trace_cli fixtures/cpp/variable_arithmetic.cpp --sandbox docker --json
```

---

# Running Tests

## Python — Full Suite

Docker Desktop must be running.

```powershell
python -m pytest tests/ -v
```

Expected Sprint 1 release result:

```text
138 passed
```

## Python — CI-Safe

No Docker required:

```powershell
python -m pytest tests/ -v -m "not integration"
```

Expected result:

```text
124 passed
```

## TypeScript — Trace Model

```powershell
cd packages/trace-model
npx vitest run
```

## TypeScript — Visual State Engine

```powershell
cd packages/visual-state-engine
npx vitest run
```

## TypeScript — Timeline

```powershell
cd packages/timeline
npx vitest run
```

## TypeScript — Variable Visualiser

```powershell
cd packages/visualizers/variable-state
npx vitest run
```

Combined TypeScript result:

```text
96 passed
```

## Complete Project Result

```text
234 tests passing
```

---

# Test Results

| Suite                                  |   Tests |
| -------------------------------------- | ------: |
| Python — Sprint 0 contracts and IR     |      54 |
| Python — C++ transformer               |      24 |
| Python — sandbox                       |      15 |
| Python — execution service             |      14 |
| Python — golden Docker integration     |      18 |
| Python — Sprint 1 API                  |      13 |
| TypeScript — trace model               |      23 |
| TypeScript — visual state engine       |      18 |
| TypeScript — timeline                  |      28 |
| TypeScript — visualisers and describer |      27 |
| **Total**                              | **234** |

The test suite verifies:

* Learning IR schema validation
* trace sequence rules
* entity identity requirements
* language adapter registration
* sandbox protocol conformance
* C++ profile validation
* real Docker execution
* raw C++ trace parsing
* Learning IR transformation
* API execution boundaries
* frontend trace ingestion
* IR version rejection
* deterministic state reconstruction
* immutable snapshots
* timeline bounds protection
* O(1) snapshot selection
* visualiser render-model semantics
* deterministic step descriptions
* execution projection synchronisation

---

# Known Limitations

The current implementation has several intentional limitations.

## Narrow C++ Profile

PRISM currently supports only C++ Trace Profile v0.1.

Complex language features remain unsupported.

The profile will be expanded only when new learning experiences require additional execution semantics.

## Line-Level Source Locations

Learning IR currently contains source line numbers but not source columns.

Monaco therefore highlights the complete active line.

## Docker Cold-Start Latency

Docker execution currently adds approximately 2–5 seconds of cold-start latency.

This is acceptable for architecture validation but requires improvement before rapid learner iteration at production scale.

Potential future directions include:

* warm execution workers
* container pooling
* persistent isolated execution environments

## Infrastructure Failure Classification

When Docker is unavailable, the current execution pipeline may classify the failure as:

```text
compilation_failed
```

The application remains stable and displays diagnostics, but the category is semantically imprecise.

A future execution failure taxonomy should distinguish:

```text
LEARNER FAILURE
    ├── unsupported_profile
    └── compilation_failed

INFRASTRUCTURE FAILURE
    └── infrastructure_unavailable
```

This limitation was discovered during Sprint 1 consumer validation.

## Current Visual Semantics

The Visual State Engine currently understands the semantics required by Learning IR v0.1.

New execution concepts such as:

* pointer relationships
* call stacks
* ownership
* asynchronous event queues

may require coordinated evolution across:

```text
Learning IR
      ↓
Trace Model
      ↓
Visual State Engine
      ↓
Visualizer
```

A visualiser plugin alone is sufficient only when representing semantics already available in visual state.

---

# Architecture Decision Records

PRISM currently has four architecture decision records.

## ADR-0001 — Contract-First Modular Architecture

PRISM Core depends on contracts rather than concrete language or infrastructure implementations.

## ADR-0002 — Learning IR Boundary

Language adapters transform language-specific runtime data into Learning IR before returning execution results.

## ADR-0003 — C++ Trace Profile v0.1

PRISM initially supports a deliberately narrow C++ subset to validate deterministic execution tracing.

## ADR-0004 — Snapshot-Based Timeline Navigation

Visual execution state is reconstructed into immutable snapshots.

Timeline navigation selects snapshots by index rather than reversing events or re-executing the program.

ADRs are available in:

```text
docs/adr/
```

---

# Documentation

## Sprint Decision Records

```text
docs/sprint-0/completion-report.md
docs/sprint-1/completion-report.md
```

## Architecture

```text
docs/architecture/sprint-0-architecture.md
docs/sprint-1/sprint-1-architecture.md
```

## Architecture Decision Records

```text
docs/adr/
```

## C++ Trace Profile

```text
docs/sprint-0/supported-cpp-profile.md
```

## Known Limitations

```text
docs/sprint-0/known-limitations.md
docs/sprint-1/known-limitations.md
```

---

# Sprint Progression

PRISM has currently validated two architectural layers.

```text
SPRINT 0
EXECUTION OBSERVATION

Can PRISM observe real program execution
and represent it language-neutrally?

            ↓

GO WITH LIMITATIONS

            ↓

SPRINT 1
VISUAL EXECUTION CORE

Can PRISM reconstruct Learning IR
and make execution understandable?

            ↓

GO
```

Together:

```text
REAL PROGRAM
      ↓
EXECUTION OBSERVATION
      ↓
LEARNING IR
      ↓
STATE RECONSTRUCTION
      ↓
TIMELINE NAVIGATION
      ↓
SYNCHRONISED VISUAL EXECUTION
```

Sprint 0 proved:

> **PRISM can observe program execution.**

Sprint 1 proved:

> **PRISM can make that execution understandable.**

---

# Next Direction

The next product question is:

> **Can PRISM use visible program state to teach a programming concept better than static explanation alone?**

The immediate direction is a lesson experience foundation.

Conceptually:

```text
LESSON DEFINITION
        ↓
LESSON LOADER
        ↓
LESSON SESSION
        ↓
CONCEPT INTRODUCTION
        ↓
STARTER CODE
        ↓
LEARNER EXECUTES
        ↓
PRISM VISUAL EXECUTION
        ↓
LEARNER OBSERVES STATE
        ↓
OBJECTIVE EVALUATION
        ↓
LESSON PROGRESSION
```

The existing narrow C++ profile provides a controlled environment for validating this learning model.

The next sprint should focus on teaching flow rather than immediately expanding language complexity.

---

# Long-Term Direction

PRISM is being architected so language adapters, execution infrastructure, visual state semantics, visualisers, and learning systems can evolve through explicit boundaries.

Conceptually:

```text
C++ ───────────┐
Python ────────┤
Rust ──────────┼──> LEARNING IR ──> VISUAL STATE ENGINE
JavaScript ────┤                         │
Java ──────────┘                         ▼
                                    VISUAL EXECUTION
                                           │
                                           ▼
                                    LEARNING EXPERIENCE
```

The long-term goal is to move beyond static programming instruction.

PRISM aims to create learning experiences where learners can:

* observe program behaviour
* navigate execution
* predict state changes
* modify code
* break assumptions
* compare outcomes
* understand runtime concepts
* build from verified understanding

> **PRISM turns program execution into a learning medium.**

---

# License

PRISM is licensed under the MIT License.

See:

```text
LICENSE
```
