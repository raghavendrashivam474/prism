# Known Limitations — Sprint 0

## Tracing Strategy (Strategy A — Source Instrumentation)

### Return-based scope detection
The instrumentor emits scope_exit and exec_end before the return statement.
This is correct for the Sprint 0 profile (all supported programs use return 0).
It would not be correct for programs that exit via multiple return paths,
exception propagation, or std::exit(). These are all outside the supported profile.

### Regex-based line matching
Variable declarations and assignments are detected via regex.
This is reliable for the Sprint 0 profile (single-line, well-formatted code).
Multi-line expressions or unusual whitespace formatting could bypass detection.
A Clang AST-based instrumentor (Strategy C) would not have this limitation.

### Column-level precision
Source locations contain line numbers only.
Column-level precision is not available with Strategy A.
This is acceptable for Sprint 0 but should be addressed if the visual
system requires column-level highlighting.

### Single return path
The instrumentor tracks scope closure on the first return statement encountered.
Multiple return paths are not supported and are not in the Sprint 0 profile.

## Profile Validator

### Regex-based detection
The validator uses compiled regex patterns per line.
Very unusual C++ formatting (e.g., a pointer declaration split across lines)
could theoretically bypass detection.
A Clang AST-based validator would be structurally correct.
This is acceptable for Sprint 0.

## Sandbox

### Docker startup latency
Each execution starts a new Docker container.
The gcc:13 image adds container startup time (~2-5 seconds).
This is acceptable for a learning platform but would require optimisation
(e.g., persistent containers, pre-warmed pools) for production use.

### Windows host / Linux container line endings
Files written from a Windows host to a Linux Docker container must have
LF line endings. The DockerSandboxProvider normalises all files to LF
before writing. This is documented and verified.

### Local sandbox has no isolation
The LocalSandboxProvider runs code directly on the host machine.
It exists for development only and must not be used with untrusted code.

## Learning IR

### irVersion hardcoded to "0.1"
Schema evolution strategy for future IR versions is not yet defined.
The irVersion field is present on all events and traces to support
future migration tooling.

### Scope nesting
The transformer assigns a single scope_id ("scope_main_1") for the main
function. Nested scopes are not tracked in Sprint 0.