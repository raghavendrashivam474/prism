/**
 * Lesson domain types.
 *
 * Lessons describe teaching intent as declarative data.
 * They do not describe UI layout, components, or styling.
 *
 * A lesson contains ordered steps.
 * Each step contains content, starter code, and one or more objectives.
 *
 * Objective definitions are imported from @prism/objectives so that
 * the lesson package does not duplicate objective semantics.
 */

// ---------------------------------------------------------------------------
// Objective reference (placeholder for Milestone 2.2)
//
// The concrete ObjectiveDefinition union lives in @prism/objectives.
// We reference it structurally here to keep the lesson model decoupled
// from the objective type union while it stabilises.
//
// From Milestone 2.5 onwards, this alias will resolve to
// import("@prism/objectives").ObjectiveDefinition.
// ---------------------------------------------------------------------------

export interface ObjectiveDefinitionShape {
  readonly id: string;
  readonly type: string;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export interface LessonContent {
  readonly explanation: string;
  readonly instruction?: string;
  readonly observationPrompt?: string;
}

// ---------------------------------------------------------------------------
// Code
// ---------------------------------------------------------------------------

export interface LessonCodeDefinition {
  readonly starterSource: string;
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export interface LessonStepDefinition {
  readonly id: string;
  readonly title: string;
  readonly content: LessonContent;
  readonly code: LessonCodeDefinition;
  readonly objectives: readonly ObjectiveDefinitionShape[];
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export interface LessonDefinition {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly languageId: string;
  readonly steps: readonly LessonStepDefinition[];
}

// ---------------------------------------------------------------------------
// Lesson summary (catalog projection)
// ---------------------------------------------------------------------------

export interface LessonSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly languageId: string;
}

export function toLessonSummary(lesson: LessonDefinition): LessonSummary {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    languageId: lesson.languageId,
  };
}