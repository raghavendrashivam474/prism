/**
 * PRISM execution result - Milestone 2.12 (corrected 2.13a).
 *
 * A PrismExecutionResult represents "PRISM ran a program once" in its
 * complete form: the trace, the reconstructed snapshot timeline, the
 * timeline controller, and any failure metadata.
 *
 * This is a reusable app-level boundary, not a lesson-specific type.
 * Both the standalone execution playground (Sprint 1's apps/web) and
 * the lesson workspace (Milestone 2.13) consume the same shape.
 *
 * ---
 * 2.13a correction note:
 *
 * The original 2.12 design modelled the failure variant as
 * snapshots:[] and timeline:empty(). Architectural review during 2.13
 * identified that this was wrong: the snapshot timeline represents the
 * EXECUTION NARRATIVE, not runtime evidence alone. A trace that ends in
 * execution.failed still produces a meaningful snapshot (the failure
 * moment). Every consumer should be able to render a timeline uniformly
 * without pattern-matching on status.
 *
 * The failure variant is now widened: snapshots may be non-empty, and
 * the timeline is built from them. Consumers that used to expect
 * "no snapshots on failure" still work because they were reading
 * status===failure to render the failure panel, not to check snapshot
 * length. The FailurePanel is still driven by the failure field; the
 * timeline is now uniformly available.
 *
 * ---
 * Invariant (enforced by builders):
 *   timeline.currentSnapshot === snapshots[timeline.currentIndex]
 *   for all non-empty results, at construction time.
 *
 * Boundaries preserved:
 *   - IR ingestion stays in @prism/trace-model.
 *   - Snapshot construction stays in @prism/visual-state-engine.
 *   - Timeline navigation stays in @prism/timeline.
 *   - This package COMPOSES those into a single result object; it does
 *     not re-implement any of them.
 */

import type { NormalizedTrace } from "@prism/trace-model";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import type { SnapshotTimelineController } from "@prism/timeline";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * The lifecycle state of a single PRISM execution attempt.
 *
 *   pending  - no attempt yet, or an attempt is in flight
 *   success  - a trace was produced and completed normally
 *   failure  - the trace ended in execution.failed
 *              (compilation, unsupported profile, sandbox error, etc.)
 *
 * Status drives which PANEL renders (success detail vs failure detail).
 * Status does NOT drive whether the timeline infrastructure exists -
 * the timeline is uniformly available on success and failure.
 */
export type PrismExecutionStatus = "pending" | "success" | "failure";

// ---------------------------------------------------------------------------
// Failure metadata
// ---------------------------------------------------------------------------

export interface PrismExecutionFailure {
  readonly category: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

/**
 * The pending state. No trace, no snapshots. Timeline is an empty controller.
 * Failure is null.
 *
 * Callers may hold onto this at app startup and replace it after the first
 * execution attempt completes.
 */
export interface PendingPrismExecutionResult {
  readonly status: "pending";
  readonly trace: null;
  readonly snapshots: readonly VisualStateSnapshot[];
  readonly timeline: SnapshotTimelineController;
  readonly failure: null;
}

/**
 * The success state. Trace present, snapshots reconstructed, timeline
 * seeded to snapshot 0. Failure is null.
 */
export interface SuccessPrismExecutionResult {
  readonly status: "success";
  readonly trace: NormalizedTrace;
  readonly snapshots: readonly VisualStateSnapshot[];
  readonly timeline: SnapshotTimelineController;
  readonly failure: null;
}

/**
 * The failure state.
 *
 * A failure result may still carry a trace and snapshots - a trace that
 * ends in execution.failed is a real execution narrative, and the visual
 * state engine will produce a snapshot for it. The timeline is populated
 * from those snapshots.
 *
 * `failure` is always populated on this variant and carries the semantic
 * category + message that drove status to failure.
 */
export interface FailurePrismExecutionResult {
  readonly status: "failure";
  readonly trace: NormalizedTrace | null;
  readonly snapshots: readonly VisualStateSnapshot[];
  readonly timeline: SnapshotTimelineController;
  readonly failure: PrismExecutionFailure;
}

export type PrismExecutionResult =
  | PendingPrismExecutionResult
  | SuccessPrismExecutionResult
  | FailurePrismExecutionResult;
