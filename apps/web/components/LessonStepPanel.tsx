/**
 * LessonStepPanel - Milestone 2.13b.
 *
 * Renders the active step's content: title, explanation, instruction,
 * and observation prompt. Purely presentational.
 */

import type { LessonStepDefinition } from "@prism/lessons";

interface Props {
  step: LessonStepDefinition;
  stepNumber: number;
  totalSteps: number;
}

export function LessonStepPanel({ step, stepNumber, totalSteps }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div>
        <p className="text-xs font-mono text-gray-400">
          STEP {stepNumber} / {totalSteps}
        </p>
        <h2 className="font-semibold text-gray-900 text-base mt-1">
          {step.title}
        </h2>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">
        {step.content.explanation}
      </p>

      {step.content.instruction && (
        <div className="rounded border-l-4 border-blue-400 bg-blue-50 px-3 py-2">
          <p className="text-xs font-semibold text-blue-800 mb-0.5">
            Instruction
          </p>
          <p className="text-sm text-blue-900">{step.content.instruction}</p>
        </div>
      )}

      {step.content.observationPrompt && (
        <div className="rounded border-l-4 border-purple-400 bg-purple-50 px-3 py-2">
          <p className="text-xs font-semibold text-purple-800 mb-0.5">
            After you run
          </p>
          <p className="text-sm text-purple-900">
            {step.content.observationPrompt}
          </p>
        </div>
      )}
    </div>
  );
}
