/**
 * Workspace state hook.
 *
 * Owns the full execution lifecycle:
 *   idle -> executing -> trace_ready | failed
 *
 * Builds snapshots once after trace ingestion.
 * Exposes a TimelineController for navigation.
 * Never re-executes C++ during navigation.
 */

"use client";

import { useState, useCallback } from "react";
import { LearningIrV01Ingestor, TraceIngestionError } from "@prism/trace-model";
import { DefaultVisualStateEngine } from "@prism/visual-state-engine";
import { SnapshotTimelineController } from "@prism/timeline";
import type { TimelineController } from "@prism/timeline";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import type { ExecutionClient } from "../execution/client";

export type WorkspaceStatus = "idle" | "executing" | "trace_ready" | "failed";

export interface WorkspaceFailure {
  category: string;
  message: string;
  violations?: Array<{ code: string; line: number | null; message: string }>;
  diagnostics?: string[];
}

export interface WorkspaceState {
  status: WorkspaceStatus;
  source: string;
  timeline: TimelineController;
  snapshots: VisualStateSnapshot[];
  failure: WorkspaceFailure | null;
  currentSnapshot: VisualStateSnapshot | null;
}

const ingestor = new LearningIrV01Ingestor();
const engine = new DefaultVisualStateEngine();

const STARTER_SOURCE = `int main() {
    int x = 10;
    x = 20;
    x = x + 5;

    return 0;
}`;

export function useWorkspace(client: ExecutionClient) {
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [source, setSource] = useState(STARTER_SOURCE);
  const [snapshots, setSnapshots] = useState<VisualStateSnapshot[]>([]);
  const [timeline, setTimeline] = useState<TimelineController>(
    SnapshotTimelineController.empty(),
  );
  const [failure, setFailure] = useState<WorkspaceFailure | null>(null);

  const run = useCallback(async () => {
    if (status === "executing") return;

    setStatus("executing");
    setFailure(null);

    try {
      const rawTrace = await client.execute({ languageId: "cpp", source });
      const trace = ingestor.ingest(rawTrace);
      const newSnapshots = engine.buildSnapshots(trace);

      // Check if the trace represents an execution failure
      const firstEvent = trace.events[0];
      if (firstEvent?.type === "execution.failed" &&
          firstEvent.payload.kind === "execution.failed") {
        setFailure({
          category: firstEvent.payload.category,
          message: firstEvent.payload.message,
          violations: [...firstEvent.payload.violations],
          diagnostics: [...firstEvent.payload.diagnostics],
        });
        setSnapshots(newSnapshots);
        setTimeline(SnapshotTimelineController.create(newSnapshots));
        setStatus("failed");
        return;
      }

      setSnapshots(newSnapshots);
      setTimeline(SnapshotTimelineController.create(newSnapshots));
      setStatus("trace_ready");
    } catch (err) {
      const message =
        err instanceof TraceIngestionError
          ? `Trace error: ${err.message}`
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred.";

      setFailure({ category: "internal_error", message });
      setStatus("failed");
    }
  }, [status, source, client]);

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

  const currentSnapshot =
    timeline.currentSnapshot ?? snapshots[0] ?? null;

  return {
    status,
    source,
    setSource,
    snapshots,
    timeline,
    failure,
    currentSnapshot,
    run,
    navigate,
  };
}