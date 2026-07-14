/**
 * Structured failure display.
 *
 * Projects Sprint 0 failure categories into user-readable states.
 * Never displays raw compiler output as the primary experience.
 */

import type { WorkspaceFailure } from "@/lib/workspace/use-workspace";

const CATEGORY_LABELS: Record<string, string> = {
  unsupported_profile: "Unsupported C++ profile",
  compilation_failed: "Compilation failed",
  execution_timed_out: "Execution timed out",
  execution_failed: "Execution failed",
  trace_invalid: "Trace error",
  internal_error: "Internal error",
};

interface Props {
  failure: WorkspaceFailure;
}

export function FailurePanel({ failure }: Props) {
  const label = CATEGORY_LABELS[failure.category] ?? "Execution failed";

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
      <div>
        <p className="font-semibold text-red-800">{label}</p>
        <p className="text-sm text-red-700 mt-1">{failure.message}</p>
      </div>

      {failure.violations && failure.violations.length > 0 && (
        <div className="space-y-1">
          {failure.violations.map((v, i) => (
            <div key={i} className="text-xs font-mono text-red-600">
              {v.line != null ? `Line ${v.line}: ` : ""}
              {v.message}
            </div>
          ))}
        </div>
      )}

      {failure.diagnostics && failure.diagnostics.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-red-600 hover:text-red-800">
            Show compiler output
          </summary>
          <pre className="mt-2 p-2 bg-red-100 rounded overflow-x-auto text-red-800 text-xs">
            {failure.diagnostics.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}