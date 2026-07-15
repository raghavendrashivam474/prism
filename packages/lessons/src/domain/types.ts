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

import type { ObjectiveDefinition } from "@prism/objectives";

// ---------------------------------------------------------------------------
// Objective reference
// ---------------------------------------------------------------------------

/**
 * Compatibility alias used by the lessons package.
 *
 * The source of truth now lives in @prism/objectives.
 */
export type ObjectiveDefinitionShape = ObjectiveDefinition;

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
