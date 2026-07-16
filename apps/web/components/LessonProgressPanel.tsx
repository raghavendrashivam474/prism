/**
 * LessonProgressPanel - Milestone 2.13b.
 *
 * Compact horizontal step list showing status per step:
 *   completed - green check
 *   active    - blue outline
 *   available - gray outline
 *   locked    - dim
 *
 * Purely presentational.
 */

import type {
  LessonDefinition,
  LessonSessionState,
  LessonStepStatus,
} from "@prism/lessons";

interface Props {
  lesson: LessonDefinition;
  session: LessonSessionState;
}

const STATUS_STYLES: Record<LessonStepStatus, string> = {
  locked: "border-gray-200 bg-gray-50 text-gray-400",
  available: "border-gray-300 bg-white text-gray-700",
  active: "border-blue-500 bg-blue-50 text-blue-900 font-semibold",
  completed: "border-green-500 bg-green-50 text-green-900",
};

function statusLabel(status: LessonStepStatus): string {
  switch (status) {
    case "locked": return "locked";
    case "available": return "available";
    case "active": return "active";
    case "completed": return "done";
  }
}

export function LessonProgressPanel({ lesson, session }: Props) {
  return (
    <div className="flex items-center gap-2">
      {session.stepStates.map((s, i) => {
        const stepDef = lesson.steps.find((d) => d.id === s.stepId);
        return (
          <div
            key={s.stepId}
            className={`flex items-center gap-2 px-2 py-1 rounded border text-xs ${STATUS_STYLES[s.status]}`}
            title={stepDef?.title ?? s.stepId}
          >
            <span className="font-mono">{i + 1}</span>
            <span className="hidden sm:inline">{statusLabel(s.status)}</span>
          </div>
        );
      })}
    </div>
  );
}
