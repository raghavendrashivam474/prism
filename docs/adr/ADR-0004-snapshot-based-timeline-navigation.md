# ADR-0004 — Snapshot-Based Timeline Navigation

**Status:** Accepted
**Date:** Sprint 1

## Context

A visual execution timeline requires the ability to navigate backwards
and forwards through program execution steps without re-running the program.

Two approaches exist:

**Option A — Reverse-event replay**
Store only the current state. On backwards navigation, replay events
from the beginning to reconstruct the target state.

**Option B — Pre-built immutable snapshots**
Build all state snapshots once at trace ingestion time. Navigation
selects a snapshot by index.

## Decision

PRISM uses Option B: pre-built immutable snapshots.

The Visual State Engine processes the NormalizedTrace once and produces
an array of VisualStateSnapshot objects. The TimelineController selects
snapshots by index. No reverse-event logic exists.

## Consequences

- Navigation is O(1) — index selection into an immutable array.
- Earlier snapshots are never mutated by later state transitions.
- The C++ program is never re-executed during navigation.
- Memory usage is proportional to trace length (acceptable for Sprint 1 profile).
- Snapshot immutability is enforced by Object.freeze at engine level.
- The current snapshot is the single authority for all visual projections.

## Rejected Approach

Reverse-event replay was rejected because:
- It requires defining inverse operations for every event type.
- It introduces complexity without benefit for the Sprint 1 profile.
- It would make snapshot immutability impossible to guarantee.
- Navigation performance would degrade for long traces.