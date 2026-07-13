# Sprint 0 Architecture

## Overview

PRISM Sprint 0 establishes a contract-driven execution pipeline that
transforms real C++ source code into deterministic, language-neutral
Learning IR events through replaceable architectural boundaries.

## Pipeline
C++ SOURCE
|
v
LANGUAGE ADAPTER CONTRACT (LanguageAdapter protocol)
|
v
C++ LANGUAGE ADAPTER (CppLanguageAdapter)
|
+-- CppProfileValidator (rejects unsupported constructs before execution)
+-- CppSourceInstrumentor (injects trace-emit calls into supported source)
|
v
SANDBOX CONTRACT (SandboxProvider protocol)
|
v
DOCKER SANDBOX (DockerSandboxProvider)
|
+-- Isolated Linux container (gcc:13)
+-- Network disabled
+-- Memory limited
|
v
COMPILE + EXECUTE (g++ -std=c++20)
|
v
RAW C++ TRACE (JSON lines on stdout)
|
v
RAW TRACE PARSER (RawCppTraceParser)
|
v
CPP TRACE TRANSFORMER (CppTraceTransformer)
|
v
LEARNING IR v0.1 (LearningTrace)
|
v
JSON OUTPUT / CLI DISPLAY

## Boundary Rules

### PRISM Core (core/execution/service.py)
- Depends only on LanguageAdapter and SandboxProvider protocols
- No imports of Docker, subprocess, Clang, GDB, or C++ adapter classes
- Verified by automated boundary tests

### Contracts (contracts/)
- LanguageAdapter protocol — language adapter boundary
- SandboxProvider protocol — sandbox boundary
- LearningTrace / LearningEvent — stable internal output format
- All schemas use Pydantic v2 with frozen models

### C++ Adapter (adapters/languages/cpp/)
- CppLanguageAdapter implements LanguageAdapter protocol
- Raw C++ trace schema (RawCppEvent) never escapes this boundary
- Profile validation occurs before any compilation
- Source instrumentation is Strategy A (see tracing-strategy-evaluation.md)

### Sandbox Adapters (adapters/sandboxes/)
- DockerSandboxProvider — production isolation
- LocalSandboxProvider — development only, no isolation
- Both implement SandboxProvider protocol
- Files normalised to LF line endings before writing to workspace

## Key Design Decisions

- Learning IR is the stable boundary between language adapters and
  future visual systems (ADR-0002)
- entityId is trace-local, never a bare display name (ADR-0002)
- C++ Trace Profile v0.1 is deliberately narrow for Sprint 0 (ADR-0003)
- Profile validation rejects unsupported code before execution
- Unsupported code never produces misleading partial Learning IR