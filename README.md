# PRISM

**Programming Interactive State Machine**

PRISM is an interactive programming-learning platform that transforms real
program execution into deterministic, language-neutral learning events.

## Sprint 0 — C++ Trace Feasibility

Sprint 0 proves that a narrow subset of real C++ execution can be transformed
into deterministic, language-neutral Learning IR events through replaceable
architectural boundaries.

**Sprint 0 Decision: GO WITH LIMITATIONS**

See `docs/sprint-0/completion-report.md` for the full decision record.

## Quick Start

### Prerequisites

- Python 3.12+
- Docker Desktop (running)

### Installation

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Run the CLI
python -m apps.trace_cli fixtures/cpp/variable_arithmetic.cpp --sandbox docker
JSON output
python -m apps.trace_cli fixtures/cpp/variable_arithmetic.cpp --sandbox docker --json
Run all tests
pytest tests/ -v
Run without Docker (CI-safe)
pytest tests/ -v -m "not integration"
Architecture
ExecutionService
    -> LanguageAdapterRegistry -> CppLanguageAdapter
    -> SandboxProvider         -> DockerSandboxProvider
    -> LearningTrace (Learning IR v0.1)

See docs/architecture/sprint-0-architecture.md
Supported C++ Profile
main() function only
local int variables
integer literal initialisation
direct assignment
arithmetic: + - * /
sequential execution
normal completion (return 0)
See docs/sprint-0/supported-cpp-profile.md

Test Results (Sprint 0 Final)
Suite    Tests
Contract    54
Unit (transformer)    24
Sandbox    15
Execution service    14
Golden integration    18
Total    125