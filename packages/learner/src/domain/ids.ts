/**
 * Branded domain IDs.
 *
 * These are compile-time-only distinctions. At runtime every branded
 * ID is just a string. The brand prevents accidental substitution
 * (e.g. passing a LessonId where a LearnerId is expected) that plain
 * `string` typing would silently allow.
 *
 * Construction goes through the `newXxxId()` helpers so tests can
 * inject deterministic values. Deserialization goes through the
 * `asXxxId()` casts which only assert intent - they perform no
 * runtime validation beyond checking that the input is a non-empty
 * string.
 */

// ---------------------------------------------------------------------------
// Brand infrastructure
// ---------------------------------------------------------------------------

declare const brand: unique symbol;
type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

// ---------------------------------------------------------------------------
// ID types
// ---------------------------------------------------------------------------

export type LearnerId = Brand<string, "LearnerId">;
export type LessonId = Brand<string, "LessonId">;
export type StepId = Brand<string, "StepId">;
export type ObjectiveId = Brand<string, "ObjectiveId">;
export type AttemptId = Brand<string, "AttemptId">;
export type ConceptId = Brand<string, "ConceptId">;

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------

function assertNonEmpty(value: string, kind: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${kind} must be a non-empty string.`);
  }
}

/**
 * ID generator abstraction. Defaults to crypto.randomUUID() when
 * available; callers can pass a fixed generator for deterministic
 * tests. Kept as a plain function so mocks are trivial.
 */
export type IdGenerator = () => string;

export function defaultIdGenerator(): string {
  // crypto.randomUUID is available in modern browsers and Node 19+.
  // Fallback keeps this package usable in older environments if
  // needed; tests always inject a deterministic generator.
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      ?.randomUUID === "function"
  ) {
    return (
      globalThis as { crypto: { randomUUID: () => string } }
    ).crypto.randomUUID();
  }
  // Extremely simple fallback - never used in production paths where
  // crypto.randomUUID is available. Deterministic tests should always
  // inject their own generator rather than relying on this.
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Cast helpers (deserialization / narrow)
// ---------------------------------------------------------------------------

export function asLearnerId(value: string): LearnerId {
  assertNonEmpty(value, "LearnerId");
  return value as LearnerId;
}

export function asLessonId(value: string): LessonId {
  assertNonEmpty(value, "LessonId");
  return value as LessonId;
}

export function asStepId(value: string): StepId {
  assertNonEmpty(value, "StepId");
  return value as StepId;
}

export function asObjectiveId(value: string): ObjectiveId {
  assertNonEmpty(value, "ObjectiveId");
  return value as ObjectiveId;
}

export function asAttemptId(value: string): AttemptId {
  assertNonEmpty(value, "AttemptId");
  return value as AttemptId;
}

export function asConceptId(value: string): ConceptId {
  assertNonEmpty(value, "ConceptId");
  return value as ConceptId;
}

// ---------------------------------------------------------------------------
// Construction helpers
// ---------------------------------------------------------------------------

export function newLearnerId(gen: IdGenerator = defaultIdGenerator): LearnerId {
  return asLearnerId(gen());
}

export function newAttemptId(gen: IdGenerator = defaultIdGenerator): AttemptId {
  return asAttemptId(gen());
}