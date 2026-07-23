/**
 * Repository contracts for @prism/learner.
 *
 * Two repositories:
 *
 *   LearnerProfileRepository   - persists the LearnerProfile record
 *                                (a small, mutable-in-place-only-by-
 *                                explicit-save value)
 *   LearnerEventStore          - append-only log of LearningEvent[]
 *                                per learner; source of truth for
 *                                every projection in this package
 *                                and in @prism/mastery
 *
 * Both interfaces are async. Current localStorage-backed
 * implementations resolve synchronously wrapped in Promise, but
 * making the contract async up front means IndexedDB, SQLite, or
 * a remote API can drop in later without changing any consumer.
 *
 * Every method that could fail (parse error, quota exceeded,
 * missing key) surfaces a RepositoryError with a machine-readable
 * code so callers can react without string-matching messages.
 *
 * Contracts:
 *
 *   LearnerProfileRepository
 *     load()   -> the stored profile, or null if none exists
 *     save()   -> replace the stored profile with the given value
 *     reset()  -> delete the stored profile (no-op if none exists)
 *
 *   LearnerEventStore
 *     append(event)              -> append one event to the learner's
 *                                   log. MUST preserve append order.
 *     loadForLearner(learnerId)  -> read the full append-ordered log
 *                                   for one learner (empty array if
 *                                   nothing has been written)
 *     clearForLearner(learnerId) -> delete the learner's log (no-op
 *                                   if none exists). Used by reset
 *                                   flows and tests.
 *
 * Deliberately absent:
 *
 *   - No delete-by-id, no update-event, no reorder. The event log
 *     is append-only. Corrections happen by emitting a compensating
 *     event, never by mutating history.
 *   - No cross-learner queries. If we ever need to read events for
 *     "all learners", it will be an explicit new method - callers
 *     shouldn't be able to reach for it accidentally.
 */

import type { LearnerId } from "../domain/ids";
import type { LearnerProfile } from "../domain/profile";
import type { LearningEvent } from "../events/types";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LearnerRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "LearnerRepositoryError";
  }
}

export const LEARNER_REPOSITORY_ERROR_CODES = {
  parseError: "PARSE_ERROR",
  unsupportedVersion: "UNSUPPORTED_VERSION",
  storageUnavailable: "STORAGE_UNAVAILABLE",
  quotaExceeded: "QUOTA_EXCEEDED",
  invalidPayload: "INVALID_PAYLOAD",
} as const;

// ---------------------------------------------------------------------------
// LearnerProfileRepository
// ---------------------------------------------------------------------------

export interface LearnerProfileRepository {
  /**
   * Load the persisted profile.
   *
   * Returns null (not throws) if no profile has ever been saved.
   * Throws LearnerRepositoryError with code PARSE_ERROR if the
   * stored value exists but is malformed, or UNSUPPORTED_VERSION
   * if it was written by a future build.
   */
  load(): Promise<LearnerProfile | null>;

  /**
   * Replace the stored profile with the given value.
   *
   * The write is atomic from the caller's perspective: on success
   * the new profile is durably stored; on failure nothing changed.
   */
  save(profile: LearnerProfile): Promise<void>;

  /**
   * Delete the stored profile. No-op if none exists.
   *
   * Callers that want to fully reset a learner (profile AND
   * events) must also clear the event store for that learnerId.
   */
  reset(): Promise<void>;
}

// ---------------------------------------------------------------------------
// LearnerEventStore
// ---------------------------------------------------------------------------

export interface LearnerEventStore {
  /**
   * Append one event to the learner's log.
   *
   * The store MUST preserve append order and MUST NOT reorder,
   * deduplicate, or drop events. If storage capacity is exceeded,
   * throw LearnerRepositoryError with code QUOTA_EXCEEDED - never
   * silently truncate the log.
   */
  append(event: LearningEvent): Promise<void>;

  /**
   * Load the full append-ordered event log for one learner.
   *
   * Returns an empty array (not throws) if nothing has ever been
   * written for the given learnerId. Throws PARSE_ERROR /
   * UNSUPPORTED_VERSION under the same conditions as
   * LearnerProfileRepository.load.
   */
  loadForLearner(
    learnerId: LearnerId,
  ): Promise<readonly LearningEvent[]>;

  /**
   * Delete the learner's log. No-op if none exists.
   *
   * This is a destructive operation. Callers that want to preserve
   * a snapshot should read via loadForLearner before clearing.
   */
  clearForLearner(learnerId: LearnerId): Promise<void>;
}