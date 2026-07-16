import { describe, it, expect } from "vitest";
import {
  pendingPrismExecutionResult,
  emptyPrismExecutionResult,
  buildSuccessPrismExecutionResult,
  buildFailurePrismExecutionResult,
  buildPrismExecutionResult,
  type PrismExecutionResult,
} from "../index";
import type { NormalizedTrace, NormalizedTraceEvent } from "@prism/trace-model";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(sequence: number): NormalizedTraceEvent {
  return {
    sequence,
    type: "execution.started",
    sourceLocation: { line: 1 },
    payload: { kind: "execution.started" },
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

function makeTrace(): NormalizedTrace {
  return {
    irVersion: "learning-ir/v0.1",
    executionId: "test-exec",
    languageId: "cpp",
    events: [makeEvent(1)],
  };
}

// ---------------------------------------------------------------------------
// Pending
// ---------------------------------------------------------------------------

describe("pendingPrismExecutionResult", () => {
  it("status is pending", () => {
    const result = pendingPrismExecutionResult();
    expect(result.status).toBe("pending");
  });

  it("trace is null", () => {
    const result = pendingPrismExecutionResult();
    expect(result.trace).toBeNull();
  });

  it("snapshots is empty", () => {
    const result = pendingPrismExecutionResult();
    expect(result.snapshots).toEqual([]);
  });

  it("timeline is an empty controller", () => {
    const result = pendingPrismExecutionResult();
    expect(result.timeline.totalSteps).toBe(0);
    expect(result.timeline.currentIndex).toBe(-1);
    expect(result.timeline.currentSnapshot).toBeNull();
  });

  it("failure is null", () => {
    const result = pendingPrismExecutionResult();
    expect(result.failure).toBeNull();
  });
});

describe("emptyPrismExecutionResult", () => {
  it("is equivalent to pendingPrismExecutionResult", () => {
    const a = pendingPrismExecutionResult();
    const b = emptyPrismExecutionResult();
    expect(a.status).toBe(b.status);
    expect(a.trace).toBe(b.trace);
    expect(a.snapshots).toEqual(b.snapshots);
    expect(a.failure).toBe(b.failure);
    expect(a.timeline.totalSteps).toBe(b.timeline.totalSteps);
  });
});

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

describe("buildSuccessPrismExecutionResult", () => {
  const trace = makeTrace();
  const snapshots = [makeSnapshot(0, 1), makeSnapshot(1, 2), makeSnapshot(2, 3)];

  it("status is success", () => {
    const result = buildSuccessPrismExecutionResult({ trace, snapshots });
    expect(result.status).toBe("success");
  });

  it("trace is preserved", () => {
    const result = buildSuccessPrismExecutionResult({ trace, snapshots });
    expect(result.trace).toBe(trace);
  });

  it("snapshots are preserved", () => {
    const result = buildSuccessPrismExecutionResult({ trace, snapshots });
    expect(result.snapshots).toEqual(snapshots);
  });

  it("timeline is seeded to snapshot 0", () => {
    const result = buildSuccessPrismExecutionResult({ trace, snapshots });
    expect(result.timeline.totalSteps).toBe(3);
    expect(result.timeline.currentIndex).toBe(0);
    expect(result.timeline.currentSnapshot).toBe(snapshots[0]);
  });

  it("timeline is navigable via .select()", () => {
    const result = buildSuccessPrismExecutionResult({ trace, snapshots });
    const at2 = result.timeline.select(2);
    expect(at2.currentIndex).toBe(2);
    expect(at2.currentSnapshot).toBe(snapshots[2]);
  });

  it("failure is null", () => {
    const result = buildSuccessPrismExecutionResult({ trace, snapshots });
    expect(result.failure).toBeNull();
  });

  it("allows an empty snapshots array (valid empty trace)", () => {
    const result = buildSuccessPrismExecutionResult({ trace, snapshots: [] });
    expect(result.status).toBe("success");
    expect(result.snapshots).toEqual([]);
    expect(result.timeline.totalSteps).toBe(0);
    expect(result.timeline.currentSnapshot).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Failure
// ---------------------------------------------------------------------------

describe("buildFailurePrismExecutionResult", () => {
  it("status is failure", () => {
    const result = buildFailurePrismExecutionResult({
      category: "compilation_failed",
      message: "syntax error",
    });
    expect(result.status).toBe("failure");
  });

  it("trace is null", () => {
    const result = buildFailurePrismExecutionResult({
      category: "compilation_failed",
      message: "syntax error",
    });
    expect(result.trace).toBeNull();
  });

  it("snapshots is empty", () => {
    const result = buildFailurePrismExecutionResult({
      category: "compilation_failed",
      message: "syntax error",
    });
    expect(result.snapshots).toEqual([]);
  });

  it("timeline is an empty controller", () => {
    const result = buildFailurePrismExecutionResult({
      category: "compilation_failed",
      message: "syntax error",
    });
    expect(result.timeline.totalSteps).toBe(0);
    expect(result.timeline.currentSnapshot).toBeNull();
  });

  it("failure preserves category and message", () => {
    const result = buildFailurePrismExecutionResult({
      category: "timeout",
      message: "sandbox timed out after 5s",
    });
    expect(result.failure).toEqual({
      category: "timeout",
      message: "sandbox timed out after 5s",
    });
  });
});

// ---------------------------------------------------------------------------
// Discriminator patterns
// ---------------------------------------------------------------------------

describe("PrismExecutionResult — discriminated union narrowing", () => {
  it("allows narrowing on status = success", () => {
    const trace = makeTrace();
    const snapshots = [makeSnapshot(0, 1)];
    const result: PrismExecutionResult = buildSuccessPrismExecutionResult({
      trace,
      snapshots,
    });

    if (result.status === "success") {
      // TypeScript narrows trace to NormalizedTrace here.
      expect(result.trace.executionId).toBe("test-exec");
    } else {
      expect.fail("expected success");
    }
  });

  it("allows narrowing on status = failure", () => {
    const result: PrismExecutionResult = buildFailurePrismExecutionResult({
      category: "compilation_failed",
      message: "boom",
    });

    if (result.status === "failure") {
      // TypeScript narrows failure to PrismExecutionFailure here.
      expect(result.failure.category).toBe("compilation_failed");
      expect(result.failure.message).toBe("boom");
    } else {
      expect.fail("expected failure");
    }
  });

  it("allows narrowing on status = pending", () => {
    const result: PrismExecutionResult = pendingPrismExecutionResult();

    if (result.status === "pending") {
      expect(result.trace).toBeNull();
      expect(result.failure).toBeNull();
    } else {
      expect.fail("expected pending");
    }
  });
});

// ---------------------------------------------------------------------------
// Union builder
// ---------------------------------------------------------------------------

describe("buildPrismExecutionResult — union builder", () => {
  it("dispatches to pending", () => {
    const result = buildPrismExecutionResult({ status: "pending" });
    expect(result.status).toBe("pending");
  });

  it("dispatches to success", () => {
    const trace = makeTrace();
    const snapshots = [makeSnapshot(0, 1), makeSnapshot(1, 2)];
    const result = buildPrismExecutionResult({
      status: "success",
      trace,
      snapshots,
    });
    expect(result.status).toBe("success");
    expect(result.timeline.totalSteps).toBe(2);
  });

  it("dispatches to failure", () => {
    const result = buildPrismExecutionResult({
      status: "failure",
      category: "compilation_failed",
      message: "syntax error",
    });
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.failure.category).toBe("compilation_failed");
  });
});

// ---------------------------------------------------------------------------
// Independence between results
// ---------------------------------------------------------------------------

describe("PrismExecutionResult — independence", () => {
  it("two pending results have independent timeline controllers", () => {
    const a = pendingPrismExecutionResult();
    const b = pendingPrismExecutionResult();
    expect(a.timeline).not.toBe(b.timeline);
  });

  it("two success results built from same inputs have independent timelines", () => {
    const trace = makeTrace();
    const snapshots = [makeSnapshot(0, 1), makeSnapshot(1, 2)];
    const a = buildSuccessPrismExecutionResult({ trace, snapshots });
    const b = buildSuccessPrismExecutionResult({ trace, snapshots });
    expect(a.timeline).not.toBe(b.timeline);

    const aAdvanced = a.timeline.select(1);
    // b remains at index 0; the two results share no navigation state.
    expect(b.timeline.currentIndex).toBe(0);
    expect(aAdvanced.currentIndex).toBe(1);
  });
});
