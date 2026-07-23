/**
 * LearnerProfile.
 *
 * The persistent identity record for a learner. Contains only
 * durable identity data:
 *
 *   - id           : the branded LearnerId
 *   - displayName  : learner-facing name
 *   - createdAt    : ISO 8601 timestamp of profile creation
 *   - profileVersion : schema version of the profile record itself
 *
 * Statistics, progress, and history are NOT stored on the profile.
 * They are projections computed from the Learning Event stream
 * (see history/projections.ts). Storing them here would create two
 * sources of truth and let the projections drift out of sync with
 * the events they derive from.
 *
 * The profile is immutable. Mutations return new profile objects.
 */

import type { LearnerId } from "./ids";
import { asLearnerId, defaultIdGenerator, type IdGenerator } from "./ids";

export const PROFILE_VERSION = 1 as const;

export interface LearnerProfile {
  readonly id: LearnerId;
  readonly displayName: string;
  readonly createdAt: string;
  readonly profileVersion: typeof PROFILE_VERSION;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface CreateLearnerProfileInput {
  readonly displayName?: string;
  readonly now?: () => string;
  readonly idGenerator?: IdGenerator;
}

/**
 * Create a fresh learner profile.
 *
 * All non-deterministic inputs (id, timestamp) are injected via
 * factories so tests can pin them. Production callers omit them
 * and get defaults (crypto.randomUUID + new Date().toISOString()).
 */
export function createLearnerProfile(
  input: CreateLearnerProfileInput = {},
): LearnerProfile {
  const id = asLearnerId((input.idGenerator ?? defaultIdGenerator)());
  const createdAt = (input.now ?? (() => new Date().toISOString()))();
  const displayName = input.displayName?.trim() || "Learner";

  return {
    id,
    displayName,
    createdAt,
    profileVersion: PROFILE_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Immutable updates
// ---------------------------------------------------------------------------

export function renameLearner(
  profile: LearnerProfile,
  nextDisplayName: string,
): LearnerProfile {
  const trimmed = nextDisplayName.trim();
  if (trimmed.length === 0) {
    throw new Error("Learner display name must be a non-empty string.");
  }
  if (trimmed === profile.displayName) {
    return profile;
  }
  return { ...profile, displayName: trimmed };
}

// ---------------------------------------------------------------------------
// Serialization guards
// ---------------------------------------------------------------------------

/**
 * Type guard for use by the persistence layer. Verifies that an
 * arbitrary JSON payload conforms to the LearnerProfile shape and
 * carries a schema version this build understands.
 *
 * This is a defensive check, not a validator - the persistence layer
 * uses it to reject corrupted or future-versioned records rather
 * than crash on access.
 */
export function isLearnerProfile(value: unknown): value is LearnerProfile {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    obj.id.length > 0 &&
    typeof obj.displayName === "string" &&
    typeof obj.createdAt === "string" &&
    obj.profileVersion === PROFILE_VERSION
  );
}