# Known Limitations - Sprint 2

## Windows Docker Sandbox Invocation

On Windows, launching the API from the repository root with the
package-style module path (`python -m uvicorn apps.api.main:app`)
causes intermittent "Access is denied" errors from Docker Desktop
when the sandbox provider tries to mount a volume for compilation.
The same underlying docker command succeeds when invoked from
PowerShell directly.

Root cause is not fully isolated. Evidence points at Docker Desktop's
file-sharing gate treating Python subprocess-launched docker requests
differently from PowerShell-launched requests, independent of user,
integrity level, working directory, or specific docker flags.

Workaround (documented in README): launch from the API app directory
with `main:app` instead of `apps.api.main:app`:

    cd apps/api
    python -m uvicorn main:app --reload --port 8000

This has been tested and works reliably. The workaround does not
affect production behavior; it only changes local dev invocation.

Sprint 3 or a dedicated debugging session may investigate further.
Not blocking Sprint 2 closure.

## Single Lesson Registered

Only two lessons are registered in the workspace:

- `cpp-understanding-variable-state` - the real Sprint 2 lesson
- `cpp-variable-basics-test` - a minimal smoke-test lesson

No lesson catalog page exists. Learners navigate to
`/lesson/{id}` directly. A catalog / index page and lesson
selection UI are Sprint 3+ concerns.

## Content Lives Inline

Lesson definitions live inline in
`apps/web/lib/lesson/lesson-registry.ts` as TypeScript modules.
No file-based, JSON-backed, or CMS-backed authoring surface exists.
This is intentional for Sprint 2 - a dedicated content boundary
adds infrastructure without proving anything about the learning
experience.

Sprint 3 or later may introduce a content package or file loader
if lesson authoring becomes a bottleneck.

## No Session Persistence

Lesson session state lives entirely in React state. Refreshing the
browser resets the session. Attempts, completed steps, and any
review acknowledgement are lost.

Persisting learner sessions across reloads (local storage,
server-side sessions, learner accounts) is a Sprint 3+ concern.
None of the Sprint 2 domain code assumes ephemerality; the session
engine returns plain values that could be serialized.

## No Attempt History Browser

Only the latest attempt on a step is browsable via Review Mode.
Prior failed attempts on the same step remain in
`LessonSessionState.stepStates[i].attempts` but are not exposed in
the UI. Attempt-history browsing was explicitly deferred past
Sprint 2 to avoid drifting into learner analytics.

## No URL-Addressable Review Mode

Review mode is per-session React state. There is no URL
representation of "reviewing step 2 of lesson X". Review links
cannot be shared. Sprint 3+.

## Show Me Interaction Is Basic

Show Me currently selects the proving snapshot in the timeline and
lets the learner investigate from there (no autoplay, per Sprint
2.15 design). It does not highlight the corresponding objective
feedback card, cycle through multiple evidence points automatically,
or animate the transition. The design intent (learner as
investigator, not spectator) is honored, but the affordance could
be visually stronger.

## No Column-Level Source Highlighting

Learning IR v0.1 carries line-only source locations. Monaco
highlighting is line-level. Multi-statement lines highlight the
entire line even when only one statement is active at a step.
This limitation was documented in Sprint 1 and remains unchanged
in Sprint 2. Learning IR v0.2 with column locations would be
required to address it.

## Integration Tests Are UI-Only

The Sprint 2 vertical integration suite (Milestone 2.17) drives a
real browser through the full learner journey but mocks the
`/api/v1/executions` endpoint with canned traces. It does not
exercise real docker compilation. This is deliberate - the tests
are meant to be deterministic, fast, and CI-friendly. A separate
real-backend integration suite would be a Sprint 3+ concern if
we ever ship a CI environment that includes Docker.

## Single Language

Only `cpp` is supported end-to-end. The architecture supports
additional languages (Learning IR is language-neutral, the
objective evaluators consume normalized traces, the lesson
definition carries a languageId field), but no other language
adapter has been implemented. Sprint 0's limitation continues.

## No Failure Category Precision

Compilation failures, unsupported profile violations, and Docker
transport failures all surface through the same
`execution.failed` event with a category string. The Sprint 2
feedback layer distinguishes execution failure from unsatisfied
objectives per handoff Section 25, but does not further
distinguish among failure subtypes. Sprint 1's known limitation
on this topic continues.

## No Concurrent Learner Isolation

The API accepts concurrent requests but has no notion of learner
identity. Two browsers hitting the same API would receive
independent responses (the Docker sandbox is per-request), but
there is no session, no authentication, and no rate limiting.
Sprint 2 is a local single-learner development environment.
Multi-learner concerns are Sprint 3+.

## Playwright Runtime Dependency

Running the integration suite requires Chromium (~180 MB) plus
FFmpeg and headless-shell binaries downloaded via
`npx playwright install chromium`. This is a one-time developer
setup, not a runtime dependency. The production build is
unaffected.

## Summary

These limitations reflect deliberate scope choices, not
architectural weaknesses. The Sprint 2 educational pipeline is
complete, validated end to end, and stable. Each limitation is
either scheduled for a later sprint or documented as a permanent
Sprint 2 boundary.