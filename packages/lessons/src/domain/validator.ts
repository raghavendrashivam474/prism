/**
 * Lesson definition validator.
 *
 * Validates the structural correctness of a LessonDefinition.
 * Does NOT evaluate lesson semantics or execute objectives.
 *
 * A malformed lesson definition must fail deterministically here
 * before it reaches the loader, session engine, or workspace.
 *
 * Validation rules (Milestone 2.2):
 *   - id, version, title, description, languageId are non-empty strings
 *   - lesson contains at least one step
 *   - step ids are unique within the lesson
 *   - each step has a non-empty title
 *   - each step has content with a non-empty explanation
 *   - each step has starter source
 *   - each step has at least one objective
 *   - objective ids are unique within a step
 *   - objective type is one of the supported types
 */

import type {
  LessonDefinition,
  LessonStepDefinition,
  ObjectiveDefinitionShape,
} from "./types";
import { SUPPORTED_OBJECTIVE_TYPES } from "./supported-objectives";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LessonValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "LessonValidationError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertNonEmptyString(
  value: unknown,
  fieldName: string,
  code: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LessonValidationError(
      `Field '${fieldName}' must be a non-empty string.`,
      code,
      { fieldName, value },
    );
  }
}

function validateObjective(
  objective: ObjectiveDefinitionShape,
  stepId: string,
  index: number,
): void {
  assertNonEmptyString(
    objective.id,
    `steps[${stepId}].objectives[${index}].id`,
    "OBJECTIVE_ID_INVALID",
  );

  assertNonEmptyString(
    objective.type,
    `steps[${stepId}].objectives[${index}].type`,
    "OBJECTIVE_TYPE_INVALID",
  );

  if (!SUPPORTED_OBJECTIVE_TYPES.has(objective.type)) {
    throw new LessonValidationError(
      `Objective type '${objective.type}' is not supported. ` +
        `Supported types: ${Array.from(SUPPORTED_OBJECTIVE_TYPES).join(", ")}.`,
      "OBJECTIVE_TYPE_UNSUPPORTED",
      { stepId, objectiveIndex: index, type: objective.type },
    );
  }
}

function validateStep(step: LessonStepDefinition, index: number): void {
  assertNonEmptyString(
    step.id,
    `steps[${index}].id`,
    "STEP_ID_INVALID",
  );

  assertNonEmptyString(
    step.title,
    `steps[${step.id}].title`,
    "STEP_TITLE_INVALID",
  );

  if (typeof step.content !== "object" || step.content === null) {
    throw new LessonValidationError(
      `Step '${step.id}' is missing content.`,
      "STEP_CONTENT_MISSING",
      { stepId: step.id },
    );
  }

  assertNonEmptyString(
    step.content.explanation,
    `steps[${step.id}].content.explanation`,
    "STEP_EXPLANATION_INVALID",
  );

  if (typeof step.code !== "object" || step.code === null) {
    throw new LessonValidationError(
      `Step '${step.id}' is missing code.`,
      "STEP_CODE_MISSING",
      { stepId: step.id },
    );
  }

  assertNonEmptyString(
    step.code.starterSource,
    `steps[${step.id}].code.starterSource`,
    "STEP_STARTER_SOURCE_INVALID",
  );

  if (!Array.isArray(step.objectives) || step.objectives.length === 0) {
    throw new LessonValidationError(
      `Step '${step.id}' must contain at least one objective.`,
      "STEP_OBJECTIVES_EMPTY",
      { stepId: step.id },
    );
  }

  const seenObjectiveIds = new Set<string>();
  step.objectives.forEach((objective, objectiveIndex) => {
    validateObjective(objective, step.id, objectiveIndex);

    if (seenObjectiveIds.has(objective.id)) {
      throw new LessonValidationError(
        `Step '${step.id}' has duplicate objective id: '${objective.id}'.`,
        "OBJECTIVE_ID_DUPLICATE",
        { stepId: step.id, objectiveId: objective.id },
      );
    }
    seenObjectiveIds.add(objective.id);
  });
}

// ---------------------------------------------------------------------------
// Public validator
// ---------------------------------------------------------------------------

export function validateLessonDefinition(lesson: LessonDefinition): void {
  assertNonEmptyString(lesson.id,          "id",          "LESSON_ID_INVALID");
  assertNonEmptyString(lesson.version,     "version",     "LESSON_VERSION_INVALID");
  assertNonEmptyString(lesson.title,       "title",       "LESSON_TITLE_INVALID");
  assertNonEmptyString(lesson.description, "description", "LESSON_DESCRIPTION_INVALID");
  assertNonEmptyString(lesson.languageId,  "languageId",  "LESSON_LANGUAGE_INVALID");

  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) {
    throw new LessonValidationError(
      "Lesson must contain at least one step.",
      "LESSON_STEPS_EMPTY",
      { lessonId: lesson.id },
    );
  }

  const seenStepIds = new Set<string>();
  lesson.steps.forEach((step, index) => {
    validateStep(step, index);

    if (seenStepIds.has(step.id)) {
      throw new LessonValidationError(
        `Lesson '${lesson.id}' has duplicate step id: '${step.id}'.`,
        "STEP_ID_DUPLICATE",
        { lessonId: lesson.id, stepId: step.id },
      );
    }
    seenStepIds.add(step.id);
  });
}