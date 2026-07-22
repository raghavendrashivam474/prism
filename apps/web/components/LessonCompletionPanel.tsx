/**
 * LessonCompletionPanel.
 *
 * Rendered at the top of the lesson column when the learner has
 * finished the lesson AND explicitly pressed Finish on the final
 * step. The finished step's content and feedback remain visible
 * below this panel so the learner can still inspect the concluding
 * concept while celebrating.
 *
 * The panel is purely presentational. All data is derived from the
 * session and lesson definition by the parent.
 */

import type {
  LessonDefinition,
  LessonSessionState,
} from "@prism/lessons";

interface Props {
  lesson: LessonDefinition;
  session: LessonSessionState;
}

export function LessonCompletionPanel({ lesson, session }: Props) {
  const totalSteps = session.stepStates.length;
  const totalAttempts = session.stepStates.reduce(
    (sum, s) => sum + s.attempts.length,
    0,
  );

  const conceptTitles = lesson.steps.map((s) => s.title);

  return (
    <div className="rounded-lg border border-green-400 bg-green-50 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">*</span>
        <div>
          <p className="text-lg font-bold text-green-900">Lesson complete</p>
          <p className="text-sm text-green-800 mt-1">
            {lesson.title}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-mono uppercase tracking-wide text-green-800 mb-2">
          Concepts you worked through
        </p>
        <ul className="space-y-1">
          {conceptTitles.map((title, i) => (
            <li
              key={i}
              className="flex items-baseline gap-2 text-sm text-green-900"
            >
              <span className="font-mono text-green-700">{i + 1}.</span>
              <span>{title}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-mono uppercase tracking-wide text-green-800">
            Completed
          </p>
          <p className="font-semibold text-green-900">
            {totalSteps} / {totalSteps} steps
          </p>
        </div>
        <div>
          <p className="text-xs font-mono uppercase tracking-wide text-green-800">
            Attempts
          </p>
          <p className="font-semibold text-green-900">{totalAttempts}</p>
        </div>
      </div>

      <p className="text-xs text-green-800 border-t border-green-300 pt-3">
        Click any completed step in the progress bar above to review it.
      </p>
    </div>
  );
}