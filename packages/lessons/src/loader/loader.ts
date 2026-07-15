/**
 * Lesson loader boundary.
 *
 * The session engine never knows where lesson definitions come from.
 * It asks a LessonLoader to resolve a lesson ID.
 *
 * Sprint 2 ships a StaticLessonLoader backed by an in-memory map.
 * Future sprints may add ApiLessonLoader, DatabaseLessonLoader, etc.
 *
 * All loaders MUST validate the lesson definition before returning it.
 */

import type { LessonDefinition } from "../domain/types";
import {
  validateLessonDefinition,
  LessonValidationError,
} from "../domain/validator";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LessonNotFoundError extends Error {
  constructor(public readonly lessonId: string) {
    super(`Lesson not found: '${lessonId}'.`);
    this.name = "LessonNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export interface LessonLoader {
  load(lessonId: string): Promise<LessonDefinition>;
}

// ---------------------------------------------------------------------------
// Static implementation
// ---------------------------------------------------------------------------

export class StaticLessonLoader implements LessonLoader {
  private readonly _lessons: Map<string, LessonDefinition>;

  constructor(lessons: readonly LessonDefinition[] = []) {
    this._lessons = new Map();
    for (const lesson of lessons) {
      this.register(lesson);
    }
  }

  /**
   * Register (or replace) a lesson.
   * The lesson is validated before being stored.
   * Malformed lessons throw LessonValidationError immediately.
   */
  register(lesson: LessonDefinition): void {
    validateLessonDefinition(lesson);
    this._lessons.set(lesson.id, lesson);
  }

  async load(lessonId: string): Promise<LessonDefinition> {
    const lesson = this._lessons.get(lessonId);
    if (!lesson) {
      throw new LessonNotFoundError(lessonId);
    }
    // Defensive re-validation guards against direct mutation after registration.
    validateLessonDefinition(lesson);
    return lesson;
  }

  /**
   * Return all known lesson IDs.
   * Used by the catalog to build summaries.
   */
  knownLessonIds(): string[] {
    return [...this._lessons.keys()];
  }

  /**
   * Return the raw registered lessons (for catalog projection).
   * The catalog is responsible for projecting to LessonSummary.
   */
  knownLessons(): LessonDefinition[] {
    return [...this._lessons.values()];
  }
}

// Re-export LessonValidationError for convenience so consumers of the loader
// can catch validation failures without importing from the domain path.
export { LessonValidationError };