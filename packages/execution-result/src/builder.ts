/**
 * PrismExecutionResult builder — Milestone 2.12.
 *
 * Centralises the composition of a PrismExecutionResult from already-
 * normalised inputs. Callers supply either:
 *
 *   - a NormalizedTrace (obtained via LearningIrV01Ingestor or a fixture)
 *     plus the reconstructed snapshots
 *   - a PrismExecutionFailure describing why execution did not produce a
 *     trace
 *
 * The builder guarantees the invariants of PrismExecutionResult:
 *
 *   - success has a trace, snapshots.length may be 0 (empty trace is valid),
 *     timeline is seeded from snapshots
 *   - failure has no trace, snapshots is [], timeline is an empty controller
 *   - pending has no trace, snapshots is [], timeline is an empty controller
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

export function buildFailurePrismExecutionResult(
  failure: PrismExecutionFailure,
): FailurePrismExecutionResult {
  return {
    status: "failure",
    trace: null,
    snapshots: [],
    timeline: SnapshotTimelineController.empty(),
    failure,
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
    | ({ status: "failure" } & PrismExecutionFailure),
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
        category: input.category,
        message: input.message,
      });
  }
}
