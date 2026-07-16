/**
 * Evidence-to-timeline linking types — Milestone 2.11.
 *
 * The linker resolves a piece of runtime evidence (something carrying a
 * `sequence`) into the array index of the VisualStateSnapshot that proves it.
 *
 * The linker is deliberately generic about what "evidence" is. It takes any
 * object with a numeric `sequence`. This lets any layer — objective evidence
 * from @prism/objectives, evidenceHint from @prism/lessons feedback, or a
 * future lesson-hint feature — feed the same linker without pulling those
 * packages into @prism/timeline's dependencies.
 */

import type { VisualStateSnapshot } from "@prism/visual-state-engine";

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

/**
 * The minimal contract the linker consumes.
 *
 * Both @prism/objectives ObjectiveEvidence and @prism/lessons
 * ObjectiveFeedback.evidenceHint structurally satisfy this.
 */
export interface EvidenceLikeInput {
  readonly sequence: number;
}

// ---------------------------------------------------------------------------
// Resolution result
// ---------------------------------------------------------------------------

/**
 * A successful evidence-to-snapshot resolution.
 *
 * snapshotIndex is the array position in the snapshots list you passed in.
 * Call SnapshotTimelineController.select(snapshotIndex) to navigate.
 *
 * stepIndex is the snapshot's own stepIndex field, exposed for callers
 * that prefer to think in terms of "execution step number" rather than
 * array position. Sprint 1 guarantees these are identical for well-formed
 * snapshot arrays, but the linker exposes both to keep the abstraction
 * explicit.
 */
export interface ResolvedEvidenceTimelineLink {
  readonly kind: "resolved";
  readonly sequence: number;
  readonly snapshotIndex: number;
  readonly stepIndex: number;
  readonly snapshot: VisualStateSnapshot;
}

/**
 * The evidence input had no usable sequence.
 *
 * This is a normal case, not an error — feedback for an unsatisfied or
 * not_evaluated objective legitimately has no evidence to point at.
 */
export interface NoEvidenceLink {
  readonly kind: "no_evidence";
  readonly reason: "missing" | "non_positive";
}

/**
 * The evidence had a sequence, but no matching snapshot exists in the
 * provided snapshot list.
 *
 * This is unexpected in normal flow — it typically indicates the caller
 * passed the wrong snapshot list. The linker returns rather than throws
 * so callers can gracefully render a "no evidence available" UI state.
 */
export interface UnresolvedEvidenceLink {
  readonly kind: "not_found";
  readonly sequence: number;
}

export type EvidenceTimelineLinkResolution =
  | ResolvedEvidenceTimelineLink
  | NoEvidenceLink
  | UnresolvedEvidenceLink;
