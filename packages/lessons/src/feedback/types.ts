/**
 * Learner feedback domain types — Milestone 2.10.
 *
 * Feedback is a PROJECTION of evaluation results into learner-facing wording.
 *
 * Feedback is NOT:
 *   - produced by objective evaluator plugins (Boundary G, handoff §24)
 *   - lesson content (that lives on LessonStepDefinition.content.explanation)
 *   - a semantic check (Boundary F, evaluators own that)
 *   - a persistence artifact (attempts already store the underlying evaluation)
 *
 * Feedback IS:
 *   - deterministic — same evaluation always yields identical feedback
 *   - structured — UI styles from tone, not from parsing text
 *   - evidence-aware — carries a hint pointing at the proving execution step
 *     so Milestone 2.11 can later attach a direct timeline jump link
 *   - honest about the execution-failure vs unsatisfied distinction
 *     (handoff §25). On execution failure we do NOT claim objectives failed.
 */

// ---------------------------------------------------------------------------
// Tone
// ---------------------------------------------------------------------------

/**
 * Semantic tone marker for the overall feedback and for each objective line.
 *
 *   success          — the step is complete
 *   partial          — some objectives satisfied, others not
 *   retry            — no objectives satisfied yet, but execution ran
 *   execution_error  — the program did not execute; nothing was observed
 *
 * UI code should style from this field, never from keyword-matching the
 * feedback text.
 */
export type LearnerFeedbackTone =
  | "success"
  | "partial"
  | "retry"
  | "execution_error";

// ---------------------------------------------------------------------------
// Per-objective feedback
// ---------------------------------------------------------------------------

/**
 * Learner-facing feedback for a single objective within a step.
 *
 * Fields:
 *   objectiveId   — the objective the feedback is about
 *   status        — mirrors StepObjectiveStatus (satisfied / unsatisfied / not_evaluated)
 *   tone          — a per-line tone marker for UI styling
 *   title         — one-line label suitable for a list heading
 *   body          — one-sentence explanation phrased at the learner
 *   evidenceHint  — reserved for Milestone 2.11 timeline linking.
 *                   When the underlying evaluation was satisfied, this holds
 *                   the sequence of the proving trace event so the UI can
 *                   later jump the timeline to that snapshot. Null when there
 *                   is no evidence (unsatisfied, not_evaluated, or a
 *                   satisfied evaluation that produced no evidence).
 */
export interface ObjectiveFeedback {
  readonly objectiveId: string;
  readonly status: "satisfied" | "unsatisfied" | "not_evaluated";
  readonly tone: LearnerFeedbackTone;
  readonly title: string;
  readonly body: string;
  readonly evidenceHint: {
    readonly sequence: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Overall feedback
// ---------------------------------------------------------------------------

export interface LearnerFeedback {
  readonly stepId: string;
  readonly tone: LearnerFeedbackTone;
  readonly heading: string;
  readonly summary: string;
  readonly objectives: readonly ObjectiveFeedback[];
}
