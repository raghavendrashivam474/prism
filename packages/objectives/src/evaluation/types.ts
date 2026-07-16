/**
 * Objective evaluation domain types - Milestone 2.6.
 *
 * These types describe what an objective evaluator consumes and produces.
 * They do NOT implement evaluation semantics - that arrives in Milestone 2.7
 * as concrete plugin implementations.
 *
 * Boundary reminder:
 *   - Evaluation consumes NormalizedTrace + VisualStateSnapshot[] from Sprint 1.
 *   - Evaluation does NOT re-execute code, re-parse source, or re-derive state.
 *   - Evaluation results include first-class runtime evidence, not just a
 *     boolean, so the evidence can later be linked to the timeline (2.11).
 *   - Evaluation results contain no learner-facing wording. Feedback wording
 *     is projected separately in Milestone 2.10.
 */

import type {
  NormalizedTrace,
  NormalizedTraceEvent,
} from "@prism/trace-model";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";

// ---------------------------------------------------------------------------
// Evaluation context
// ---------------------------------------------------------------------------

/**
 * Context passed to every objective evaluator plugin.
 *
 * The context intentionally exposes both the raw normalized trace and the
 * reconstructed snapshot timeline. Different evaluators need different
 * projections:
 *   - value-change objectives are naturally expressed as trace-event queries
 *   - value-equals objectives are naturally expressed as snapshot queries
 *
 * Evaluators MUST treat these inputs as immutable.
 */
export interface ObjectiveEvaluationContext {
  readonly trace: NormalizedTrace;
  readonly snapshots: readonly VisualStateSnapshot[];
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/**
 * Runtime evidence describing WHY an objective's evaluation returned the
 * result it did.
 *
 * The `sequence` field is deliberately preserved so that later milestones
 * (2.11) can translate evidence into a snapshot index and let the timeline
 * navigate directly to the proving execution step.
 *
 * The `observed` field is an opaque bag of evaluator-defined runtime facts:
 *   - a value that was reached
 *   - a transition that was observed
 *   - the identity of the observed entity
 *   - anything else the evaluator wants to expose about the runtime moment
 *
 * `observed` MUST NOT contain learner-facing text. It is machine data.
 */
export interface ObjectiveEvidence {
  readonly sequence: number;
  readonly entityId?: string;
  readonly observed: Readonly<Record<string, unknown>>;
  readonly relatedEvent?: NormalizedTraceEvent;
}

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

/**
 * The result an evaluator returns for a single objective definition.
 *
 * `satisfied` - pure semantic answer, no wording.
 * `evidence`  - zero or more runtime facts supporting the answer.
 *
 * An evaluator MAY return an unsatisfied result with evidence (for example,
 * "x reached 15 but never 20"). An evaluator MAY return a satisfied result
 * with evidence pointing at the exact proving moment.
 *
 * Evidence is optional but strongly encouraged for the satisfied case so
 * that the timeline can jump directly to the proof.
 */
export interface ObjectiveEvaluationResult {
  readonly objectiveId: string;
  readonly satisfied: boolean;
  readonly evidence: readonly ObjectiveEvidence[];
}
