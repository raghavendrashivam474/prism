/**
 * LessonFeedbackPanel.
 *
 * Renders a LearnerFeedback record. Tone drives styling; text is taken
 * verbatim from the projector output. Per-objective entries with an
 * evidenceHint expose a "Show Me" button that focuses the timeline on
 * the proving snapshot via the parent's onShowMe callback.
 *
 * The advance button (last row) is labelled by the parent via
 * continueLabel so the same panel is used for the mid-lesson
 * "Continue to next step" and the terminal "Finish lesson" actions.
 *
 * This component does NOT know how the timeline works. It just calls
 * onShowMe with a sequence number.
 */

import type {
  LearnerFeedback,
  LearnerFeedbackTone,
  ObjectiveFeedback,
} from "@prism/lessons";

interface Props {
  feedback: LearnerFeedback;
  onShowMe(sequence: number): void;
  onContinue?: () => void;
  canContinue?: boolean;
  continueLabel?: string;
}

const OVERALL_TONE_STYLES: Record<LearnerFeedbackTone, string> = {
  success: "border-green-300 bg-green-50",
  partial: "border-yellow-300 bg-yellow-50",
  retry: "border-blue-300 bg-blue-50",
  execution_error: "border-red-300 bg-red-50",
};

const OVERALL_HEADING_STYLES: Record<LearnerFeedbackTone, string> = {
  success: "text-green-800",
  partial: "text-yellow-800",
  retry: "text-blue-800",
  execution_error: "text-red-800",
};

const OBJECTIVE_TONE_STYLES: Record<LearnerFeedbackTone, string> = {
  success: "border-green-300 bg-white",
  partial: "border-gray-200 bg-white",
  retry: "border-blue-200 bg-white",
  execution_error: "border-red-200 bg-white",
};

const OBJECTIVE_BADGE_STYLES: Record<LearnerFeedbackTone, string> = {
  success: "bg-green-100 text-green-800",
  partial: "bg-yellow-100 text-yellow-800",
  retry: "bg-blue-100 text-blue-800",
  execution_error: "bg-red-100 text-red-800",
};

function objectiveBadgeLabel(o: ObjectiveFeedback): string {
  switch (o.status) {
    case "satisfied": return "satisfied";
    case "unsatisfied": return "not yet";
    case "not_evaluated": return "not evaluated";
  }
}

export function LessonFeedbackPanel({
  feedback,
  onShowMe,
  onContinue,
  canContinue,
  continueLabel = "Continue to next step",
}: Props) {
  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${OVERALL_TONE_STYLES[feedback.tone]}`}
    >
      <div>
        <p
          className={`font-semibold text-sm ${OVERALL_HEADING_STYLES[feedback.tone]}`}
        >
          {feedback.heading}
        </p>
        <p className="text-sm text-gray-800 mt-1">{feedback.summary}</p>
      </div>

      <ul className="space-y-2">
        {feedback.objectives.map((o) => {
          const hasEvidence = o.evidenceHint !== null;
          return (
            <li
              key={o.objectiveId}
              className={`rounded border p-2 ${OBJECTIVE_TONE_STYLES[o.tone]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {o.title}
                </span>
                <span
                  className={`text-xs font-semibold rounded px-2 py-0.5 ${OBJECTIVE_BADGE_STYLES[o.tone]}`}
                >
                  {objectiveBadgeLabel(o)}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{o.body}</p>

              {hasEvidence && (
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onShowMe(o.evidenceHint!.sequence)}
                    className="text-xs font-semibold rounded border border-blue-300 bg-white text-blue-700 px-2 py-1 hover:bg-blue-50 transition-colors"
                  >
                    Show me
                  </button>
                  <button
                    type="button"
                    onClick={() => onShowMe(o.evidenceHint!.sequence)}
                    className="text-xs font-mono text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    jump to evidence (step {o.evidenceHint!.sequence})
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {onContinue && canContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="w-full mt-2 px-3 py-1.5 rounded bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          {continueLabel}
        </button>
      )}
    </div>
  );
}