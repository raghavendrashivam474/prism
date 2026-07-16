/**
 * PRISM execution result — Milestone 2.12.
 *
 * A PrismExecutionResult represents "PRISM ran a program once" in its
 * complete form: the trace, the reconstructed snapshot timeline, the
 * timeline controller, and any failure metadata.
 *
 * This is a reusable app-level boundary, not a lesson-specific type.
 * Both the standalone execution playground (Sprint 1's apps/web) and
 * the lesson workspace (Milestone 2.13) consume the same shape.
 *
 * Boundaries preserved:
 *   - IR ingestion stays in @prism/trace-model.
 *   - Snapshot construction stays in @prism/visual-state-engine.
 *   - Timeline navigation stays in @prism/timeline.
 *   - This package COMPOSES those into a single result object; it does
 *     not re-implement any of them.
 *
 * Failure vs unsatisfied distinction (handoff §25):
 *   Execution failure is a first-class variant of this union. It is NOT
 *   modelled as a "success with zero snapshots". Callers can pattern-match
 *   on `status` and preserve the distinction all the way to the UI.
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
 *   pending  — no attempt yet, or an attempt is in flight
 *   success  — a trace was produced and snapshots were reconstructed
 *   failure  — the program did not execute (compilation, unsupported
 *              profile, sandbox error, etc.)
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
 * The failure state. No trace. No snapshots. Timeline is an empty controller.
 * Failure is populated with the semantic category and message.
 */
export interface FailurePrismExecutionResult {
  readonly status: "failure";
  readonly trace: null;
  readonly snapshots: readonly VisualStateSnapshot[];
  readonly timeline: SnapshotTimelineController;
  readonly failure: PrismExecutionFailure;
}

export type PrismExecutionResult =
  | PendingPrismExecutionResult
  | SuccessPrismExecutionResult
  | FailurePrismExecutionResult;
