/**
 * Lesson catalog.
 *
 * Exposes lesson summaries for lesson selection UIs.
 * Does NOT expose full lesson definitions or session state.
 * Does NOT execute lessons.
 *
 * The catalog reads from a LessonLoader.
 * This separation ensures the catalog boundary does not know how
 * lessons are stored, only how to project them for browsing.
 */

import type { LessonDefinition, LessonSummary } from "../domain/types";
import { toLessonSummary } from "../domain/types";

export interface LessonCatalog {
  list(): LessonSummary[];
  hasLesson(lessonId: string): boolean;
}

export class StaticLessonCatalog implements LessonCatalog {
  constructor(private readonly _lessons: readonly LessonDefinition[]) {}

  list(): LessonSummary[] {
    return this._lessons.map(toLessonSummary);
  }

  hasLesson(lessonId: string): boolean {
    return this._lessons.some((l) => l.id === lessonId);
  }
}