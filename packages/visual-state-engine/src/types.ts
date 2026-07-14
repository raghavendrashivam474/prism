/**
 * Visual State Engine — domain types.
 *
 * These types describe WHAT the program state is at each execution step.
 * They contain no UI semantics: no colours, no animation hints,
 * no component names.
 *
 * Visualisers read these types and produce render models.
 */

import type { NormalizedTraceEvent } from "@prism/trace-model";

// ---------------------------------------------------------------------------
// Entity state
// ---------------------------------------------------------------------------

export interface EntityState {
  readonly entityId: string;
  readonly kind: "variable";
  readonly displayName: string;
  readonly dataType: string;
  readonly value: number;
}

// ---------------------------------------------------------------------------
// Scope state
// ---------------------------------------------------------------------------

export interface ScopeState {
  readonly scopeId: string;
  readonly displayName: string;
}

// ---------------------------------------------------------------------------
// Execution status
// ---------------------------------------------------------------------------

export type ExecutionStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

// ---------------------------------------------------------------------------
// Visual state
// ---------------------------------------------------------------------------

export interface VisualState {
  readonly executionStatus: ExecutionStatus;
  readonly activeScopes: readonly ScopeState[];
  readonly entities: Readonly<Record<string, EntityState>>;
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface VisualStateSnapshot {
  readonly stepIndex: number;
  readonly sequence: number;
  readonly event: NormalizedTraceEvent;
  readonly state: VisualState;
}