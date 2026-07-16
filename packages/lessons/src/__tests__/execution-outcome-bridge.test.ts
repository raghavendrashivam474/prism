import { describe, it, expect } from "vitest";
import { toExecutionOutcome } from "../index";
import {
  pendingPrismExecutionResult,
  buildSuccessPrismExecutionResult,
  buildFailurePrismExecutionResult,
} from "@prism/execution-result";
import type { NormalizedTrace, NormalizedTraceEvent } from "@prism/trace-model";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";

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

describe("toExecutionOutcome", () => {
  it("returns null for pending", () => {
    const outcome = toExecutionOutcome(pendingPrismExecutionResult());
    expect(outcome).toBeNull();
  });

  it("returns success outcome for success result", () => {
    const trace = makeTrace();
    const snapshots = [makeSnapshot(0, 1)];
    const result = buildSuccessPrismExecutionResult({ trace, snapshots });
    const outcome = toExecutionOutcome(result);
    expect(outcome).not.toBeNull();
    if (outcome === null || outcome.kind !== "success") return;
    expect(outcome.trace).toBe(trace);
    expect(outcome.snapshots).toBe(snapshots);
  });

  it("returns failure outcome for pure transport failure", () => {
    const result = buildFailurePrismExecutionResult({
      failure: { category: "internal_error", message: "network" },
    });
    const outcome = toExecutionOutcome(result);
    expect(outcome).not.toBeNull();
    if (outcome === null || outcome.kind !== "failure") return;
    expect(outcome.category).toBe("internal_error");
    expect(outcome.message).toBe("network");
  });

  it("returns failure outcome for trace-backed failure (does not leak trace/snapshots)", () => {
    const trace = makeTrace();
    const snapshots = [makeSnapshot(0, 1)];
    const result = buildFailurePrismExecutionResult({
      failure: { category: "compilation_failed", message: "syntax error" },
      trace,
      snapshots,
    });
    const outcome = toExecutionOutcome(result);
    expect(outcome).not.toBeNull();
    if (outcome === null || outcome.kind !== "failure") return;
    // ExecutionOutcome failure variant intentionally has no trace/snapshots —
    // handoff §25: on failure, "no runtime observation was possible" for
    // objective evaluation. The bridge respects that even when the underlying
    // PrismExecutionResult carries a failure snapshot for UI navigation.
    expect(outcome.category).toBe("compilation_failed");
    expect(outcome.message).toBe("syntax error");
    expect((outcome as Record<string, unknown>).trace).toBeUndefined();
    expect((outcome as Record<string, unknown>).snapshots).toBeUndefined();
  });
});
