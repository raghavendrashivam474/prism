/**
 * PrismExecutionResult ? ExecutionOutcome bridge - Milestone 2.13a.
 *
 * The lesson-side ExecutionOutcome (Milestone 2.8) is structurally very
 * close to PrismExecutionResult (@prism/execution-result), but not the
 * same type. This tiny function translates from the app-shared execution
 * boundary to the lesson-domain outcome that evaluateStep and
 * recordAttempt consume.
 *
 * Rules:
 *
 *   - status === "success" ? { kind: "success", trace, snapshots }
 *   - status === "failure" ? { kind: "failure", category, message }
 *   - status === "pending" ? null (cannot evaluate a pending execution)
 *
 * The bridge lives in @prism/lessons rather than @prism/execution-result
 * to preserve dependency direction: lessons depends on execution-result,
 * not the reverse.
 */

import type { PrismExecutionResult } from "@prism/execution-result";
import type { ExecutionOutcome } from "./types";

export function toExecutionOutcome(
  result: PrismExecutionResult,
): ExecutionOutcome | null {
  switch (result.status) {
    case "pending":
      return null;
    case "success":
      return {
        kind: "success",
        trace: result.trace,
        snapshots: result.snapshots,
      };
    case "failure":
      return {
        kind: "failure",
        category: result.failure.category,
        message: result.failure.message,
      };
  }
}
