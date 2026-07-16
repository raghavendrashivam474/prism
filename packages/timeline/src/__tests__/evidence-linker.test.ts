import { describe, it, expect } from "vitest";
import {
  EvidenceTimelineLinker,
  linkEvidence,
  SnapshotTimelineController,
} from "../index";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import type { NormalizedTraceEvent } from "@prism/trace-model";

// ---------------------------------------------------------------------------
// Snapshot fixture builder
//
// Sprint 1 guarantees stepIndex matches array position and each snapshot's
// sequence matches its underlying event's sequence. The linker relies on
// this contract, so the fixtures preserve it.
// ---------------------------------------------------------------------------

function makeEvent(sequence: number): NormalizedTraceEvent {
  return {
    sequence,
    type: "entity.value_changed",
    sourceLocation: { line: sequence },
    entityId: `var_x_1`,
    payload: {
      kind: "entity.value_changed",
      previousValue: sequence - 1,
      value: sequence,
    },
  };
}

function makeSnapshot(stepIndex: number, sequence: number): VisualStateSnapshot {
  return {
    stepIndex,
    sequence,
    event: makeEvent(sequence),
    state: {
      executionStatus: "running",
      activeScopes: [],
      entities: {},
    },
  };
}

function makeSnapshots(sequences: number[]): VisualStateSnapshot[] {
  return sequences.map((seq, i) => makeSnapshot(i, seq));
}

// ---------------------------------------------------------------------------
// Resolved cases
// ---------------------------------------------------------------------------

describe("EvidenceTimelineLinker — resolved", () => {
  it("resolves a sequence that matches a snapshot", () => {
    const snapshots = makeSnapshots([1, 2, 3, 4, 5]);
    const linker = new EvidenceTimelineLinker();
    const result = linker.resolve(snapshots, { sequence: 3 });

    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") return;
    expect(result.snapshotIndex).toBe(2);
    expect(result.stepIndex).toBe(2);
    expect(result.sequence).toBe(3);
    expect(result.snapshot).toBe(snapshots[2]);
  });

  it("resolves the first snapshot", () => {
    const snapshots = makeSnapshots([1, 2, 3]);
    const result = linkEvidence(snapshots, { sequence: 1 });
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") return;
    expect(result.snapshotIndex).toBe(0);
  });

  it("resolves the last snapshot", () => {
    const snapshots = makeSnapshots([1, 2, 3]);
    const result = linkEvidence(snapshots, { sequence: 3 });
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") return;
    expect(result.snapshotIndex).toBe(2);
  });

  it("returned snapshotIndex is consumable by SnapshotTimelineController.select()", () => {
    const snapshots = makeSnapshots([1, 2, 3, 4]);
    const controller = SnapshotTimelineController.create(snapshots);

    const result = linkEvidence(snapshots, { sequence: 3 });
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") return;

    const navigated = controller.select(result.snapshotIndex);
    expect(navigated.currentIndex).toBe(2);
    expect(navigated.currentSnapshot).toBe(snapshots[2]);
  });

  it("handles non-contiguous sequences (defensive; Sprint 1 guarantees contiguity)", () => {
    // Even if sequences were sparse (they should not be), the linker
    // resolves by exact match on the sequence value.
    const snapshots = makeSnapshots([10, 20, 30]);
    const result = linkEvidence(snapshots, { sequence: 20 });
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") return;
    expect(result.snapshotIndex).toBe(1);
    expect(result.sequence).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// No-evidence cases
// ---------------------------------------------------------------------------

describe("EvidenceTimelineLinker — no_evidence", () => {
  const snapshots = makeSnapshots([1, 2, 3]);

  it("returns no_evidence/missing for null input", () => {
    const result = linkEvidence(snapshots, null);
    expect(result.kind).toBe("no_evidence");
    if (result.kind !== "no_evidence") return;
    expect(result.reason).toBe("missing");
  });

  it("returns no_evidence/missing for undefined input", () => {
    const result = linkEvidence(snapshots, undefined);
    expect(result.kind).toBe("no_evidence");
    if (result.kind !== "no_evidence") return;
    expect(result.reason).toBe("missing");
  });

  it("returns no_evidence/missing for a non-finite sequence", () => {
    const result = linkEvidence(snapshots, { sequence: NaN });
    expect(result.kind).toBe("no_evidence");
    if (result.kind !== "no_evidence") return;
    expect(result.reason).toBe("missing");
  });

  it("returns no_evidence/non_positive for sequence 0", () => {
    const result = linkEvidence(snapshots, { sequence: 0 });
    expect(result.kind).toBe("no_evidence");
    if (result.kind !== "no_evidence") return;
    expect(result.reason).toBe("non_positive");
  });

  it("returns no_evidence/non_positive for negative sequence", () => {
    const result = linkEvidence(snapshots, { sequence: -1 });
    expect(result.kind).toBe("no_evidence");
    if (result.kind !== "no_evidence") return;
    expect(result.reason).toBe("non_positive");
  });
});

// ---------------------------------------------------------------------------
// Not-found cases
// ---------------------------------------------------------------------------

describe("EvidenceTimelineLinker — not_found", () => {
  it("returns not_found when no snapshot matches the sequence", () => {
    const snapshots = makeSnapshots([1, 2, 3]);
    const result = linkEvidence(snapshots, { sequence: 99 });
    expect(result.kind).toBe("not_found");
    if (result.kind !== "not_found") return;
    expect(result.sequence).toBe(99);
  });

  it("returns not_found against an empty snapshot list", () => {
    const result = linkEvidence([], { sequence: 1 });
    expect(result.kind).toBe("not_found");
  });

  it("does not throw for not_found — callers may render a diagnostic state", () => {
    const snapshots = makeSnapshots([1, 2, 3]);
    expect(() => linkEvidence(snapshots, { sequence: 42 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Determinism / statelessness
// ---------------------------------------------------------------------------

describe("EvidenceTimelineLinker — determinism", () => {
  it("repeated resolutions produce equal results", () => {
    const snapshots = makeSnapshots([1, 2, 3, 4, 5]);
    const linker = new EvidenceTimelineLinker();

    const a = linker.resolve(snapshots, { sequence: 4 });
    const b = linker.resolve(snapshots, { sequence: 4 });
    expect(a).toEqual(b);
  });

  it("does not mutate the input snapshot array", () => {
    const snapshots = makeSnapshots([1, 2, 3]);
    const before = [...snapshots];
    linkEvidence(snapshots, { sequence: 2 });
    expect(snapshots).toEqual(before);
  });

  it("one linker instance can be shared across many resolutions", () => {
    const linker = new EvidenceTimelineLinker();
    const snapshotsA = makeSnapshots([1, 2, 3]);
    const snapshotsB = makeSnapshots([10, 20, 30]);

    const a = linker.resolve(snapshotsA, { sequence: 2 });
    const b = linker.resolve(snapshotsB, { sequence: 20 });

    expect(a.kind).toBe("resolved");
    expect(b.kind).toBe("resolved");
    if (a.kind !== "resolved" || b.kind !== "resolved") return;
    expect(a.snapshotIndex).toBe(1);
    expect(b.snapshotIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Structural compatibility with feedback and objective evidence
// ---------------------------------------------------------------------------

describe("EvidenceTimelineLinker — accepts any object with a sequence field", () => {
  const snapshots = makeSnapshots([1, 2, 3]);

  it("accepts an ObjectiveEvidence-shaped input", () => {
    const evidence = {
      sequence: 2,
      entityId: "var_x_1",
      observed: { value: 20 },
    };
    const result = linkEvidence(snapshots, evidence);
    expect(result.kind).toBe("resolved");
  });

  it("accepts an ObjectiveFeedback.evidenceHint-shaped input", () => {
    const evidenceHint = { sequence: 2 };
    const result = linkEvidence(snapshots, evidenceHint);
    expect(result.kind).toBe("resolved");
  });
});
