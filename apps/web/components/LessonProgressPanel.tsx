/**
 * LessonProgressPanel.
 *
 * Compact horizontal step list showing status per step:
 *   completed - green check; clickable to enter review mode (Milestone 2.15)
 *   active    - blue outline
 *   available - gray outline
 *   locked    - dim
 *
 * Only completed chips are interactive.
 */

import type {
  LessonDefinition,
  LessonSessionState,
  LessonStepStatus,
} from "@prism/lessons";

interface Props {
  lesson: LessonDefinition;
  session: LessonSessionState;
  reviewingStepId?: string | null;
  onReviewStep?(stepId: string): void;
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

export function LessonProgressPanel({
  lesson,
  session,
  reviewingStepId,
  onReviewStep,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      {session.stepStates.map((s, i) => {
        const stepDef = lesson.steps.find((d) => d.id === s.stepId);
        const isCompleted = s.status === "completed";
        const isReviewing = reviewingStepId === s.stepId;
        const canReview =
          isCompleted && onReviewStep && s.attempts.length > 0;

        const baseClasses =
          "flex items-center gap-2 px-2 py-1 rounded border text-xs";
        const statusClasses = STATUS_STYLES[s.status];
        const interactiveClasses = canReview
          ? "cursor-pointer hover:ring-2 hover:ring-green-300"
          : "";
        const reviewingClasses = isReviewing ? "ring-2 ring-green-400" : "";

        const title = canReview
          ? `Review ${stepDef?.title ?? s.stepId}`
          : stepDef?.title ?? s.stepId;

        const handleClick = canReview
          ? () => onReviewStep!(s.stepId)
          : undefined;

        return (
          <button
            key={s.stepId}
            type="button"
            className={`${baseClasses} ${statusClasses} ${interactiveClasses} ${reviewingClasses}`}
            title={title}
            onClick={handleClick}
            disabled={!canReview}
          >
            <span className="font-mono">{i + 1}</span>
            <span className="hidden sm:inline">{statusLabel(s.status)}</span>
          </button>
        );
      })}
    </div>
  );
}