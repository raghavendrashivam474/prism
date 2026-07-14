# Sprint 1 Architecture

## Overview

Sprint 1 consumes Sprint 0.

Real C++ source is executed through the Sprint 0 pipeline, producing
Learning IR v0.1. The Sprint 1 consumer stack transforms this trace
into a deterministic, synchronised visual execution experience.

## Full Pipeline
BROWSER
|
v
Next.js Workspace (apps/web)
|
v
useWorkspace hook
|
+-- HttpExecutionClient
| |
| v
| HTTP POST /api/v1/executions
| |
| v
| FastAPI Route (apps/api)
| |
| v
| ExecutionService [SPRINT 0]
| |
| v
| DockerSandboxProvider + CppLanguageAdapter
| |
| v
| Learning IR v0.1 (JSON)
| |
| v
| HTTP 200 response
|
v
LearningIrV01Ingestor
|
v
NormalizedTrace (frontend-owned model)
|
v
DefaultVisualStateEngine
|
v
VisualStateSnapshot[] (immutable, one per event)
|
v
SnapshotTimelineController (currentIndex)
|
v
currentSnapshot <-- single authority
|
+-----+-------------+---------------------+
| | | |
v v v v
Monaco VariableStateVisualizer LearningIrV01StepDescriber
line -> VariableRenderModel -> StepDescription
highlight | |
| v v
v VariablePanel Step description text
Editor React component React component


## Frontend Package Boundaries

All frontend business logic lives in pure TypeScript packages:
packages/
trace-model/ Learning IR v0.1 ingestion + types
visual-state-engine/ Snapshot builder + pure reducer
timeline/ Snapshot navigation
visualizers/variable-state/ Variable render model + step describer + plugin registry


**None of these packages depend on:**
- React
- Next.js
- HTTP
- Monaco
- CSS
- Browser APIs

React components in `apps/web/components/` consume render models
produced by the visualiser package. They contain zero business logic.

## Key Sprint 1 Rules Enforced

1. **Learning IR is not passed raw to the state engine.**
   `LearningIrV01Ingestor` validates and normalises first.

2. **State snapshots are immutable.**
   `Object.freeze` at engine level. Earlier snapshots are never
   affected by later state transitions (verified by test).

3. **No reverse-event replay exists.**
   Timeline navigation is snapshot selection only.
   The C++ program is never re-executed during navigation.

4. **The current snapshot is the single authority.**
   Monaco, variable panel, and description all derive from
   `currentSnapshot`. There is no independent step state anywhere.

5. **Visualisers do not know about C++.**
   They consume `VisualStateSnapshot`, not Learning IR or raw traces.
   Language-agnostic by construction.

6. **API route does not import Docker.**
   Verified by automated import inspection.

## Component Responsibilities

| Component | Owns | Does NOT own |
|---|---|---|
| Monaco editor | Source input, line highlight rendering | Timeline state, IR parsing, HTTP |
| VariablePanel | Rendering variable cards | State reduction, IR parsing |
| TimelineControls | Button rendering, click callbacks | Navigation logic |
| SnapshotTimelineController | currentIndex, navigation methods | Snapshot construction, UI |
| DefaultVisualStateEngine | Snapshot construction | Timeline state, UI |
| LearningIrV01Ingestor | IR validation, normalisation | State reduction, UI |
| useWorkspace | Execution lifecycle, snapshot storage | UI layout |
| ExecutionService [Sprint 0] | Pipeline orchestration | HTTP, UI |