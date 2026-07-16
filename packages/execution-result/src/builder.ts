/**
 * PrismExecutionResult builder — Milestone 2.12 (corrected 2.13a).
 *
 * Centralises the composition of a PrismExecutionResult from already-
 * normalised inputs. Callers supply either:
 *
 *   - a NormalizedTrace and reconstructed snapshots (success or failure)
 *   - a PrismExecutionFailure alone (e.g. transport error where no trace
 *     was produced at all)
 *
 * The builder guarantees:
 *
 *   1. success has a non-null trace; snapshots may be [] (empty trace valid);
 *      timeline is seeded from snapshots.
 *   2. failure may carry a trace and snapshots (execution narrative that
 *      ended in execution.failed) OR may carry nothing (pure transport
 *      failure). Timeline reflects whichever snapshots are provided.
 *   3. pending has no trace, snapshots is [], timeline is empty.
 *   4. Invariant: for any non-empty snapshots array, the returned timeline
 *      satisfies `timeline.currentSnapshot === snapshots[timeline.currentIndex]`
 *      at construction time.
 *
 * The builder does NOT ingest raw IR JSON. IR ingestion lives in
 * @prism/trace-model. The builder also does NOT run the visual state engine.
 * The caller supplies snapshots already reconstructed by
 * @prism/visual-state-engine. This keeps the builder a pure composition
 * function with no cross-package responsibilities.
 */

import type { NormalizedTrace } from "@prism/trace-model";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import { SnapshotTimelineController } from "@prism/timeline";
import type {
  PendingPrismExecutionResult,
  SuccessPrismExecutionResult,
  FailurePrismExecutionResult,
  PrismExecutionResult,
  PrismExecutionFailure,
} from "./types";

// ---------------------------------------------------------------------------
// Pending
// ---------------------------------------------------------------------------

export function pendingPrismExecutionResult(): PendingPrismExecutionResult {
  return {
    status: "pending",
    trace: null,
    snapshots: [],
    timeline: SnapshotTimelineController.empty(),
    failure: null,
  };
}

/**
 * Alias for pendingPrismExecutionResult(). Convenience for callers that
 * prefer "empty" semantics at initialisation time.
 */
export function emptyPrismExecutionResult(): PendingPrismExecutionResult {
  return pendingPrismExecutionResult();
}

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

export interface BuildSuccessInput {
  readonly trace: NormalizedTrace;
  readonly snapshots: readonly VisualStateSnapshot[];
}

export function buildSuccessPrismExecutionResult(
  input: BuildSuccessInput,
): SuccessPrismExecutionResult {
  return {
    status: "success",
    trace: input.trace,
    snapshots: input.snapshots,
    timeline: SnapshotTimelineController.create([...input.snapshots]),
    failure: null,
  };
}

// ---------------------------------------------------------------------------
// Failure
// ---------------------------------------------------------------------------

/**
 * Build a failure result.
 *
 * Two supported shapes:
 *
 *   1. Trace-backed failure: the backend produced a trace whose last event
 *      is execution.failed. Callers pass the trace and reconstructed
 *      snapshots so the timeline can render the failure moment.
 *
 *   2. Pure transport failure: no trace was produced (network error,
 *      internal_error). Callers pass only the failure metadata and omit
 *      trace/snapshots.
 *
 * Both shapes preserve the FailurePrismExecutionResult contract:
 * `failure` is always populated; `snapshots` and `timeline` reflect
 * whatever narrative was produced (possibly empty).
 */
export interface BuildFailureInput {
  readonly failure: PrismExecutionFailure;
  readonly trace?: NormalizedTrace | null;
  readonly snapshots?: readonly VisualStateSnapshot[];
}

export function buildFailurePrismExecutionResult(
  input: BuildFailureInput | PrismExecutionFailure,
): FailurePrismExecutionResult {
  // Backwards-compatible: allow the old
  //   buildFailurePrismExecutionResult({ category, message })
  // shape by detecting the direct-PrismExecutionFailure form.
  const normalized: BuildFailureInput =
    "failure" in input
      ? input
      : { failure: input };

  const snapshots = normalized.snapshots ?? [];
  const trace = normalized.trace ?? null;

  return {
    status: "failure",
    trace,
    snapshots,
    timeline:
      snapshots.length > 0
        ? SnapshotTimelineController.create([...snapshots])
        : SnapshotTimelineController.empty(),
    failure: normalized.failure,
  };
}

// ---------------------------------------------------------------------------
// Union builder
// ---------------------------------------------------------------------------

/**
 * Convenience builder for callers that pattern-match on a discriminator
 * they already hold. Equivalent to calling the specific builder directly.
 */
export function buildPrismExecutionResult(
  input:
    | { status: "pending" }
    | ({ status: "success" } & BuildSuccessInput)
    | ({ status: "failure" } & BuildFailureInput),
): PrismExecutionResult {
  switch (input.status) {
    case "pending":
      return pendingPrismExecutionResult();
    case "success":
      return buildSuccessPrismExecutionResult({
        trace: input.trace,
        snapshots: input.snapshots,
      });
    case "failure":
      return buildFailurePrismExecutionResult({
        failure: input.failure,
        trace: input.trace,
        snapshots: input.snapshots,
      });
  }
}
