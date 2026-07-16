/**
 * Runtime objective domain model - Milestone 2.5.
 *
 * Objectives describe runtime learning intent.
 * They do NOT describe lesson progression, UI state, or feedback wording.
 *
 * A runtime objective answers questions like:
 *   - Did x exist?
 *   - Did x ever equal 20?
 *   - Did x directly change from 10 to 20?
 *   - Did execution complete normally?
 *
 * Objectives are satisfied by observed runtime behaviour, not by matching
 * source-code text.
 */

// ---------------------------------------------------------------------------
// Objective type identifiers
// ---------------------------------------------------------------------------

export const OBJECTIVE_TYPES = [
  "entity_exists",
  "entity_value_equals",
  "entity_value_changed",
  "execution_completed",
] as const;

export type ObjectiveType = (typeof OBJECTIVE_TYPES)[number];

/**
 * Runtime-readable supported type set.
 *
 * Exported as ReadonlySet<string> so consuming validators can safely check
 * arbitrary runtime input before it is narrowed to ObjectiveType.
 */
export const SUPPORTED_OBJECTIVE_TYPES: ReadonlySet<string> =
  new Set<string>(OBJECTIVE_TYPES);

export function isObjectiveType(value: string): value is ObjectiveType {
  return SUPPORTED_OBJECTIVE_TYPES.has(value);
}

// ---------------------------------------------------------------------------
// Base definition
// ---------------------------------------------------------------------------

export interface BaseObjectiveDefinition {
  readonly id: string;
  readonly type: ObjectiveType;
}

// ---------------------------------------------------------------------------
// Entity objectives
// ---------------------------------------------------------------------------

/**
 * Requires that an observed runtime entity with the given display name exists.
 *
 * In Sprint 2's initial C++ lesson set, this maps to variable names such as `x`.
 */
export interface EntityExistsObjectiveDefinition
  extends BaseObjectiveDefinition {
  readonly type: "entity_exists";
  readonly displayName: string;
}

/**
 * Requires that an observed runtime entity reaches the specified value.
 */
export interface EntityValueEqualsObjectiveDefinition
  extends BaseObjectiveDefinition {
  readonly type: "entity_value_equals";
  readonly displayName: string;
  readonly value: number;
}

/**
 * Requires that an observed runtime entity directly changes from one value
 * to another value.
 */
export interface EntityValueChangedObjectiveDefinition
  extends BaseObjectiveDefinition {
  readonly type: "entity_value_changed";
  readonly displayName: string;
  readonly from: number;
  readonly to: number;
}

// ---------------------------------------------------------------------------
// Execution objective
// ---------------------------------------------------------------------------

/**
 * Requires that program execution completes normally.
 */
export interface ExecutionCompletedObjectiveDefinition
  extends BaseObjectiveDefinition {
  readonly type: "execution_completed";
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export type ObjectiveDefinition =
  | EntityExistsObjectiveDefinition
  | EntityValueEqualsObjectiveDefinition
  | EntityValueChangedObjectiveDefinition
  | ExecutionCompletedObjectiveDefinition;
