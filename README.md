# PRISM

**Programming Interactive State Machine**

PRISM transforms real program execution into deterministic,
language-neutral learning events.

## Sprint 0 — C++ Trace Feasibility

### Prerequisites
- Python 3.12+
- Docker Desktop (running)

### Install
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Run
python -m apps.trace_cli fixtures/cpp/variable_arithmetic.cpp
python -m apps.trace_cli fixtures/cpp/variable_arithmetic.cpp --json
Test
pytest
Decision
See docs/sprint-0/completion-report.md
