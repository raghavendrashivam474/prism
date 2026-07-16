/**
 * FeedbackProjector — Milestone 2.10.
 *
 * Projects a StepEvaluation into a LearnerFeedback.
 *
 * Design notes:
 *   - Deterministic. Same evaluation always yields identical feedback.
 *   - No dependency on evaluator plugins. Consumes ONLY the semantic result.
 *   - Handoff §25 rule: on execution failure, do NOT claim objectives were
 *     unsatisfied. Say the program did not execute. Objectives are described
 *     as not_evaluated in that case.
 *   - Handoff §24 rule: feedback wording lives here, not in evaluators.
 *   - Subclassable: authors can override per-objective-type message builders
 *     to customise wording without touching evaluators. Sprint 2 ships a
 *     single default projector.
 *   - No I18n hook yet — Sprint 2 is English-only.
 */

import type {
  LessonStepDefinition,
  ObjectiveDefinitionShape,
} from "../domain/types";
import type {
  StepEvaluation,
  StepObjectiveOutcome,
} from "../evaluation/types";
import type { LessonAttempt } from "../session/types";
import type {
  LearnerFeedback,
  LearnerFeedbackTone,
  ObjectiveFeedback,
} from "./types";

export class FeedbackProjector {
  /**
   * Project a step evaluation into learner-facing feedback.
   */
  projectStepFeedback(
    step: LessonStepDefinition,
    evaluation: StepEvaluation,
  ): LearnerFeedback {
    if (evaluation.verdict === "execution_failed") {
      return this._projectExecutionFailed(step, evaluation);
    }

    const objectives = evaluation.outcomes.map((outcome) =>
      this._projectObjective(step, outcome),
    );

    if (evaluation.verdict === "complete") {
      return {
        stepId: step.id,
        tone: "success",
        heading: "Step complete",
        summary: `You satisfied every objective for "${step.title}".`,
        objectives,
      };
    }

    // verdict === "incomplete"
    const satisfiedCount = evaluation.outcomes.filter(
      (o) => o.status === "satisfied",
    ).length;
    const totalCount = evaluation.outcomes.length;

    const tone: LearnerFeedbackTone =
      satisfiedCount > 0 ? "partial" : "retry";

    const heading =
      satisfiedCount > 0
        ? "Some objectives satisfied"
        : "Keep going";

    const summary =
      satisfiedCount > 0
        ? `You satisfied ${satisfiedCount} of ${totalCount} objectives for "${step.title}". Review the remaining ones and try again.`
        : `Your program ran, but none of the objectives for "${step.title}" were satisfied yet. Try again.`;

    return {
      stepId: step.id,
      tone,
      heading,
      summary,
      objectives,
    };
  }

  /**
   * Convenience wrapper that projects feedback for the most recent attempt
   * on a step.
   *
   * Throws if the attempt's evaluation.stepId does not match the step's id —
   * this is a programmer error, not a learner-visible failure.
   */
  projectAttemptFeedback(
    step: LessonStepDefinition,
    attempt: LessonAttempt,
  ): LearnerFeedback {
    if (attempt.evaluation.stepId !== step.id) {
      throw new Error(
        `projectAttemptFeedback: attempt evaluation stepId '${attempt.evaluation.stepId}' does not match step id '${step.id}'.`,
      );
    }
    return this.projectStepFeedback(step, attempt.evaluation);
  }

  // -------------------------------------------------------------------------
  // Execution failure
  // -------------------------------------------------------------------------

  private _projectExecutionFailed(
    step: LessonStepDefinition,
    evaluation: StepEvaluation,
  ): LearnerFeedback {
    const objectives: ObjectiveFeedback[] = evaluation.outcomes.map(
      (outcome) => {
        const definition = this._findObjective(step, outcome.objectiveId);
        return {
          objectiveId: outcome.objectiveId,
          status: "not_evaluated",
          tone: "execution_error",
          title: this._titleForObjective(definition),
          body: "Your program did not execute, so this objective was not evaluated.",
          evidenceHint: null,
        };
      },
    );

    return {
      stepId: step.id,
      tone: "execution_error",
      heading: "Your program did not execute",
      summary:
        evaluation.failure !== null
          ? `Execution failed (${evaluation.failure.category}). Fix the error and run again — no runtime evidence was produced.`
          : "Execution failed. Fix the error and run again — no runtime evidence was produced.",
      objectives,
    };
  }

  // -------------------------------------------------------------------------
  // Per-objective projection
  // -------------------------------------------------------------------------

  private _projectObjective(
    step: LessonStepDefinition,
    outcome: StepObjectiveOutcome,
  ): ObjectiveFeedback {
    const definition = this._findObjective(step, outcome.objectiveId);
    const title = this._titleForObjective(definition);

    if (outcome.status === "not_evaluated") {
      // Reachable only when a partial-failure StepEvaluation is constructed
      // outside evaluateStep. evaluateStep itself only produces not_evaluated
      // outcomes on the execution_failed path, which is handled above. This
      // branch is defensive.
      return {
        objectiveId: outcome.objectiveId,
        status: "not_evaluated",
        tone: "execution_error",
        title,
        body: "This objective was not evaluated because the program did not execute.",
        evidenceHint: null,
      };
    }

    if (outcome.status === "satisfied") {
      const result = outcome.result;
      const evidenceHint =
        result !== null && result.evidence.length > 0
          ? { sequence: result.evidence[0].sequence }
          : null;

      return {
        objectiveId: outcome.objectiveId,
        status: "satisfied",
        tone: "success",
        title,
        body: this._satisfiedBody(definition),
        evidenceHint,
      };
    }

    // status === "unsatisfied"
    return {
      objectiveId: outcome.objectiveId,
      status: "unsatisfied",
      tone: "retry",
      title,
      body: this._unsatisfiedBody(definition),
      evidenceHint: null,
    };
  }

  // -------------------------------------------------------------------------
  // Wording per objective type
  //
  // Overridable in a subclass. Kept private in the default projector.
  // -------------------------------------------------------------------------

  private _titleForObjective(
    definition: ObjectiveDefinitionShape | null,
  ): string {
    if (definition === null) {
      return "Unknown objective";
    }

    switch (definition.type) {
      case "entity_exists":
        return `Create ${this._entityName(definition)}`;
      case "entity_value_equals":
        return `Set ${this._entityName(definition)} to ${(definition as { value: number }).value}`;
      case "entity_value_changed":
        return `Change ${this._entityName(definition)} from ${(definition as { from: number }).from} to ${(definition as { to: number }).to}`;
      case "execution_completed":
        return "Program runs to completion";
      default:
        return "Objective";
    }
  }

  private _satisfiedBody(
    definition: ObjectiveDefinitionShape | null,
  ): string {
    if (definition === null) return "Satisfied.";

    switch (definition.type) {
      case "entity_exists":
        return `${this._entityName(definition)} was created during execution.`;
      case "entity_value_equals":
        return `${this._entityName(definition)} reached the value ${(definition as { value: number }).value} during execution.`;
      case "entity_value_changed":
        return `${this._entityName(definition)} changed directly from ${(definition as { from: number }).from} to ${(definition as { to: number }).to} during execution.`;
      case "execution_completed":
        return "Your program executed and completed normally.";
      default:
        return "Satisfied.";
    }
  }

  private _unsatisfiedBody(
    definition: ObjectiveDefinitionShape | null,
  ): string {
    if (definition === null) return "Not yet satisfied.";

    switch (definition.type) {
      case "entity_exists":
        return `${this._entityName(definition)} was not created during execution.`;
      case "entity_value_equals":
        return `${this._entityName(definition)} never reached the value ${(definition as { value: number }).value} during execution.`;
      case "entity_value_changed":
        return `${this._entityName(definition)} did not change directly from ${(definition as { from: number }).from} to ${(definition as { to: number }).to} during execution.`;
      case "execution_completed":
        return "Your program did not complete normally.";
      default:
        return "Not yet satisfied.";
    }
  }

  private _entityName(definition: ObjectiveDefinitionShape): string {
    const displayName = (definition as { displayName?: string }).displayName;
    return displayName ? `\`${displayName}\`` : "the variable";
  }

  private _findObjective(
    step: LessonStepDefinition,
    objectiveId: string,
  ): ObjectiveDefinitionShape | null {
    return step.objectives.find((o) => o.id === objectiveId) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Convenience functions
// ---------------------------------------------------------------------------

const defaultProjector = new FeedbackProjector();

export function projectStepFeedback(
  step: LessonStepDefinition,
  evaluation: StepEvaluation,
): LearnerFeedback {
  return defaultProjector.projectStepFeedback(step, evaluation);
}

export function projectAttemptFeedback(
  step: LessonStepDefinition,
  attempt: LessonAttempt,
): LearnerFeedback {
  return defaultProjector.projectAttemptFeedback(step, attempt);
}
