# Known Limitations — Sprint 1

## Failure Category Precision

When Docker is unavailable, the pipeline returns
`category="compilation_failed"` because the C++ adapter cannot
distinguish "compiler failed inside container" from "cannot reach
container runtime at all" — both surface as a non-zero exit from
the `docker run` command with no useful stdout.

Sprint 2 should introduce an `infrastructure_unavailable` category
at the sandbox layer so the frontend can distinguish user-facing
compilation errors from operator-facing infrastructure problems.

Current behaviour is intentional and documented: infrastructure
failures do surface, but under a slightly imprecise label.

## Monaco Line Highlighting

Highlighting is line-level only. Sprint 0 Learning IR does not carry
column information. Multi-statement lines would highlight the entire
line even if only one statement is active at a step.

Learning IR v0.2 with column-level source locations is required to
address this — deferred until a consumer requirement demonstrates
that line-level precision is genuinely insufficient.

## Single Language

Only `cpp` is currently registered in the frontend workspace.
The architecture supports language switching (the language selector
in the API request is a string), but no UI is exposed.
This is a UI omission, not an architectural constraint.

## No Trace Persistence

Executions are ephemeral. Refreshing the browser clears the trace.
Sprint 1 explicitly does not include storage — persistence is a
separate concern.

## Docker Cold-Start Latency

First execution after starting Docker Desktop takes several seconds.
Subsequent executions are faster because the gcc:13 image is cached.
Container warm-up is deferred to a later sprint.

## No Concurrent Execution Protection Server-Side

The `useWorkspace` hook disables the Run button while an execution
is in flight, but the API accepts concurrent requests. This is fine
for a single-learner dev environment but would need addressing before
multi-tenant deployment.

## Vulnerable Dependencies

`npm install` reports 4 vulnerabilities in transitive dependencies
(Next.js dev toolchain). These are development-only and do not affect
production output. `npm audit fix --force` should be evaluated before
Sprint 2 begins.