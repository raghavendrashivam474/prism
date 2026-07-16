/**
 * ExecutionRunner - Milestone 2.13a.
 *
 * The single orchestration entry point for "run this source code and give
 * me a PrismExecutionResult." Owns:
 *
 *   1. Calling the execution API via ExecutionClient
 *   2. Ingesting the returned raw trace via LearningIrV01Ingestor
 *   3. Building snapshots via DefaultVisualStateEngine
 *   4. Detecting whether the trace terminated in execution.failed
 *   5. Composing a PrismExecutionResult (success or failure)
 *
 * ExecutionRunner is lesson-agnostic. It does not know about lessons,
 * attempts, or feedback. Any orchestration that requires those lives one
 * layer higher.
 *
 * Verb note: PRISM uses "execute" consistently across ExecutionService,
 * ExecutionOutcome, ExecutionResult. The runner method is `execute` for
 * consistency, not `run`.
 */

"use client";

import { LearningIrV01Ingestor, TraceIngestionError } from "@prism/trace-model";
import { DefaultVisualStateEngine } from "@prism/visual-state-engine";
import {
  buildSuccessPrismExecutionResult,
  buildFailurePrismExecutionResult,
  type PrismExecutionResult,
} from "@prism/execution-result";
import type { ExecutionClient, ExecutionRequest } from "./client";

export interface ExecutionRunner {
  execute(input: ExecutionRequest): Promise<PrismExecutionResult>;
}

const ingestor = new LearningIrV01Ingestor();
const engine = new DefaultVisualStateEngine();

export class HttpExecutionRunner implements ExecutionRunner {
  constructor(private readonly client: ExecutionClient) {}

  async execute(input: ExecutionRequest): Promise<PrismExecutionResult> {
    try {
      const rawTrace = await this.client.execute(input);
      const trace = ingestor.ingest(rawTrace);
      const snapshots = engine.buildSnapshots(trace);

      // Trace-terminated-in-failure: last event dictates.
      const lastEvent = trace.events[trace.events.length - 1];
      const isFailureTrace =
        lastEvent?.type === "execution.failed" &&
        lastEvent.payload.kind === "execution.failed";

      if (isFailureTrace) {
        // Narrow to failure payload for category/message.
        const failedPayload =
          lastEvent!.payload.kind === "execution.failed"
            ? lastEvent!.payload
            : null;

        return buildFailurePrismExecutionResult({
          failure: {
            category: failedPayload?.category ?? "execution_failed",
            message: failedPayload?.message ?? "Execution failed.",
          },
          trace,
          snapshots,
        });
      }

      return buildSuccessPrismExecutionResult({ trace, snapshots });
    } catch (err) {
      // Transport-layer or ingestion-layer failure. No trace was produced.
      const message =
        err instanceof TraceIngestionError
          ? `Trace error: ${err.message}`
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred.";

      const category =
        err instanceof TraceIngestionError ? "trace_invalid" : "internal_error";

      return buildFailurePrismExecutionResult({
        failure: { category, message },
      });
    }
  }
}
