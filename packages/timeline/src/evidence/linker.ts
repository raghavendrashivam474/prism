/**
 * EvidenceTimelineLinker — Milestone 2.11.
 *
 * Pure. No I/O, no mutation, no controller side-effects.
 *
 * Given a VisualStateSnapshot array and an evidence-like input, resolves
 * to the snapshot index that proves the evidence.
 *
 * Design rules (handoff §23):
 *
 *   - The linker returns an index. It does NOT call
 *     SnapshotTimelineController.select() itself. Selection is a caller
 *     concern — the caller may want to preview the link without navigating.
 *   - The linker resolves by matching evidence.sequence against
 *     snapshot.sequence, and returns the snapshot's array position.
 *   - Missing / non-positive sequences resolve to "no_evidence", not an
 *     error. Feedback for an unsatisfied objective legitimately has no
 *     evidence.
 *   - Sequences with no matching snapshot resolve to "not_found", not an
 *     error. This is a diagnostic state the caller can render.
 *
 * The linker is stateless. A single instance is safe to share.
 */

import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import type {
  EvidenceLikeInput,
  EvidenceTimelineLinkResolution,
} from "./types";

export class EvidenceTimelineLinker {
  /**
   * Resolve one piece of evidence against a snapshot array.
   *
   * Nullable input is intentionally supported so callers can pass
   * ObjectiveFeedback.evidenceHint directly without a null guard.
   */
  resolve(
    snapshots: readonly VisualStateSnapshot[],
    evidence: EvidenceLikeInput | null | undefined,
  ): EvidenceTimelineLinkResolution {
    if (evidence === null || evidence === undefined) {
      return { kind: "no_evidence", reason: "missing" };
    }

    const sequence = evidence.sequence;

    if (typeof sequence !== "number" || !Number.isFinite(sequence)) {
      return { kind: "no_evidence", reason: "missing" };
    }

    if (sequence <= 0) {
      return { kind: "no_evidence", reason: "non_positive" };
    }

    const snapshotIndex = snapshots.findIndex((s) => s.sequence === sequence);

    if (snapshotIndex === -1) {
      return { kind: "not_found", sequence };
    }

    const snapshot = snapshots[snapshotIndex];

    return {
      kind: "resolved",
      sequence,
      snapshotIndex,
      stepIndex: snapshot.stepIndex,
      snapshot,
    };
  }
}

// ---------------------------------------------------------------------------
// Module-level convenience
// ---------------------------------------------------------------------------

const defaultLinker = new EvidenceTimelineLinker();

export function linkEvidence(
  snapshots: readonly VisualStateSnapshot[],
  evidence: EvidenceLikeInput | null | undefined,
): EvidenceTimelineLinkResolution {
  return defaultLinker.resolve(snapshots, evidence);
}
