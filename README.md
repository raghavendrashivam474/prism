# PRISM

**Programming Interactive State Machine**

An interactive programming-learning platform that transforms real
program execution into deterministic, language-neutral learning events —
and renders them as a step-by-step visual execution experience.

---

## Current Status

**Sprint 0 — GO WITH LIMITATIONS** — real C++ execution → Learning IR
**Sprint 1 — GO** — Learning IR → synchronised visual execution

234 tests passing (124 Python + 96 TypeScript + 14 Docker integration).

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker Desktop (running)

### Install

```powershell
# Python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"

# Node
npm install
Run
Terminal 1 — API

python -m uvicorn apps.api.main:app --reload --port 8000

Terminal 2 — Web

cd apps/web
npm run dev

Open http://localhost:3000

CLI (Sprint 0 direct pipeline)
python -m apps.trace_cli fixtures/cpp/variable_arithmetic.cpp --sandbox docker

Tests

# Python — all
python -m pytest tests/ -v

# Python — no Docker required
python -m pytest tests/ -v -m "not integration"

# TypeScript — per package
cd packages/trace-model && npx vitest run
cd packages/visual-state-engine && npx vitest run
cd packages/timeline && npx vitest run
cd packages/visualizers/variable-state && npx vitest run

Architecture

Browser
   |
   v
Next.js Workspace (apps/web)
   |
   v
useWorkspace  ->  HttpExecutionClient  ->  FastAPI (apps/api)
                                              |
                                              v
                                          ExecutionService [Sprint 0]
                                              |
                                              v
                                          Learning IR v0.1 JSON
   |
   v
LearningIrV01Ingestor  ->  NormalizedTrace
   |
   v
DefaultVisualStateEngine  ->  VisualStateSnapshot[]  (immutable)
   |
   v
SnapshotTimelineController  ->  currentSnapshot
                                     |
                                     +--> Monaco line highlight
                                     +--> VariableStateVisualizer -> VariablePanel
                                     +--> LearningIrV01StepDescriber -> description

One snapshot drives every visual element on screen.

Supported C++ Profile (v0.1)
main() function only
Local int variables
Integer literal initialisation
Direct assignment
Arithmetic: + - * /
Sequential execution
return 0;
See docs/sprint-0/supported-cpp-profile.md

Documentation
docs/sprint-0/completion-report.md — Sprint 0 decision record
docs/sprint-1/completion-report.md — Sprint 1 decision record
docs/architecture/sprint-0-architecture.md
docs/sprint-1/sprint-1-architecture.md
docs/adr/ — Architecture Decision Records (ADR-0001 through ADR-0004)