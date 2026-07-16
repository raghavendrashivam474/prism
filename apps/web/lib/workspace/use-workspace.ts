/**
 * Workspace state hook — Milestone 2.13a refactor.
 *
 * Now composes around ExecutionRunner + PrismExecutionResult instead of
 * inlining ingestion and snapshot construction. The observable behavior
 * for the playground is unchanged:
 *
 *   idle -> executing -> trace_ready | failed
 *
 * Notes:
 *   - `currentSnapshot` still derives from timeline.currentSnapshot.
 *   - Failure now retains navigable snapshots when the trace produced them
 *     (widened failure variant, see 2.13a). The failure PANEL still
 *     renders based on status===failed; the timeline remains available.
 *   - The hook no longer knows about ingestion, engine construction, or
 *     API details. It just holds the current PrismExecutionResult.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import type { TimelineController } from "@prism/timeline";
import type { PrismExecutionResult } from "@prism/execution-result";
import { pendingPrismExecutionResult } from "@prism/execution-result";
import type { ExecutionRunner } from "../execution/runner";

export type WorkspaceStatus = "idle" | "executing" | "trace_ready" | "failed";

export interface WorkspaceFailure {
  category: string;
  message: string;
  violations?: Array<{ code: string; line: number | null; message: string }>;
  diagnostics?: string[];
}

const STARTER_SOURCE = `int main() {
    int x = 10;
    x = 20;
    x = x + 5;

    return 0;
}`;

export function useWorkspace(runner: ExecutionRunner) {
  const [source, setSource] = useState(STARTER_SOURCE);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<PrismExecutionResult>(
    pendingPrismExecutionResult(),
  );
  // Timeline is stored separately so navigation mutates only this slice
  // rather than rebuilding the entire PrismExecutionResult on each step.
  const [timeline, setTimeline] = useState<TimelineController>(
    result.timeline,
  );

  const status: WorkspaceStatus = useMemo(() => {
    if (isExecuting) return "executing";
    if (result.status === "pending") return "idle";
    if (result.status === "failure") return "failed";
    return "trace_ready";
  }, [isExecuting, result.status]);

  const failure: WorkspaceFailure | null = useMemo(() => {
    if (result.status !== "failure") return null;

    // Enrich with violations/diagnostics if the trace's failure event
    // carries them. This preserves the Sprint 1 FailurePanel richness.
    const lastEvent = result.trace?.events[result.trace.events.length - 1];
    if (
      lastEvent?.type === "execution.failed" &&
      lastEvent.payload.kind === "execution.failed"
    ) {
      return {
        category: result.failure.category,
        message: result.failure.message,
        violations: [...lastEvent.payload.violations],
        diagnostics: [...lastEvent.payload.diagnostics],
      };
    }

    return {
      category: result.failure.category,
      message: result.failure.message,
    };
  }, [result]);

  const snapshots: readonly VisualStateSnapshot[] = result.snapshots;

  const currentSnapshot: VisualStateSnapshot | null =
    timeline.currentSnapshot ?? snapshots[0] ?? null;

  const execute = useCallback(async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      const next = await runner.execute({ languageId: "cpp", source });
      setResult(next);
      setTimeline(next.timeline);
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, source, runner]);

  const navigate = useCallback(
    (action: "next" | "previous" | "first" | "last" | number) => {
      setTimeline((prev) => {
        if (typeof action === "number") return prev.select(action);
        switch (action) {
          case "next":     return prev.next();
          case "previous": return prev.previous();
          case "first":    return prev.first();
          case "last":     return prev.last();
        }
      });
    },
    [],
  );

  return {
    status,
    source,
    setSource,
    snapshots,
    timeline,
    failure,
    currentSnapshot,
    result,
    // Preserve the old `run` name so existing page.tsx keeps working
    // without changes in this commit. 2.13b may rename to `execute`
    // if the lesson workspace prefers that.
    run: execute,
    navigate,
  };
}
