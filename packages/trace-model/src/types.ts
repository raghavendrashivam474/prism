/**
 * Frontend-owned normalised trace model.
 *
 * This is NOT the raw API JSON shape.
 * The ingestor maps API JSON -> these types.
 * The visual state engine consumes these types.
 *
 * No UI semantics exist here: no colours, no animation types,
 * no component names, no panel positions.
 */

export type TraceEventType =
  | "execution.started"
  | "scope.entered"
  | "scope.exited"
  | "entity.created"
  | "entity.value_changed"
  | "execution.completed"
  | "execution.failed";

export interface SourceLocation {
  readonly line: number;
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export interface ExecutionStartedPayload {
  readonly kind: "execution.started";
}

export interface ScopeEnteredPayload {
  readonly kind: "scope.entered";
  readonly scopeId: string;
  readonly displayName: string;
}

export interface ScopeExitedPayload {
  readonly kind: "scope.exited";
  readonly scopeId: string;
  readonly displayName: string;
}

export interface EntityCreatedPayload {
  readonly kind: "entity.created";
  readonly entityKind: "variable";
  readonly displayName: string;
  readonly dataType: string;
  readonly value: number;
  readonly scopeId: string;
}

export interface EntityValueChangedPayload {
  readonly kind: "entity.value_changed";
  readonly previousValue: number;
  readonly value: number;
}

export interface ExecutionCompletedPayload {
  readonly kind: "execution.completed";
}

export interface ExecutionFailedPayload {
  readonly kind: "execution.failed";
  readonly category: string;
  readonly message: string;
  readonly diagnostics: readonly string[];
  readonly violations: readonly {
    readonly code: string;
    readonly line: number | null;
    readonly message: string;
  }[];
}

export type TraceEventPayload =
  | ExecutionStartedPayload
  | ScopeEnteredPayload
  | ScopeExitedPayload
  | EntityCreatedPayload
  | EntityValueChangedPayload
  | ExecutionCompletedPayload
  | ExecutionFailedPayload;

// ---------------------------------------------------------------------------
// Event envelope
// ---------------------------------------------------------------------------

export interface NormalizedTraceEvent {
  readonly sequence: number;
  readonly type: TraceEventType;
  readonly sourceLocation: SourceLocation;
  readonly entityId?: string;
  readonly payload: TraceEventPayload;
}

// ---------------------------------------------------------------------------
// Trace
// ---------------------------------------------------------------------------

export interface NormalizedTrace {
  readonly irVersion: string;
  readonly executionId: string;
  readonly languageId: string;
  readonly events: readonly NormalizedTraceEvent[];
}