# # Tracing Strategy Spike - Strategy C: Clang AST Tooling

INVESTIGATION NOTES - not production code.

Concept:
    Use libclang Python bindings to parse C++ source into an AST.
    Visit VarDecl and BinaryOperator (assignment) nodes.
    Inject trace hooks at structurally correct positions.

Findings:
    - Structurally correct - operates on the parsed AST.
    - Handles all C++ formatting correctly by design.
    - Exact source location mapping via AST node locations.
    - libclang Python bindings available but version-sensitive.
    - Native Clang must be installed and accessible.
    - Implementation complexity: VERY HIGH for Sprint 0 budget.

Future value:
    Recommended upgrade for Sprint 1+ expanded profile.
    Eliminates all source-rewriting correctness concerns.

Verdict: Not selected for Sprint 0.
