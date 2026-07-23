/**
 * localStorage-backed implementations of the learner repositories.
 *
 * Design notes:
 *
 *   - Storage is injected via a small StorageLike interface that
 *     matches localStorage's shape. This lets us unit-test the
 *     serialization/deserialization logic in Node without a real
 *     browser Storage object, and lets consumers substitute
 *     sessionStorage or a stub if needed.
 *
 *   - Every stored payload carries a schema version. On load, an
 *     unknown or newer version raises UNSUPPORTED_VERSION rather
 *     than silently coercing. This is the "fail loud on future
 *     data" convention.
 *
 *   - JSON parse errors raise PARSE_ERROR. The alternative
 *     (returning null and silently discarding) would let
 *     corrupted state hide indefinitely.
 *
 *   - Quota-exceeded errors raise QUOTA_EXCEEDED. The event log
 *     is append-only and grows over time; a real production
 *     deployment would eventually need rotation or IndexedDB.
 *     Sprint 3 documents this as a known limitation.
 *
 *   - Deletes are idempotent. Repository.reset() and
 *     clearForLearner() never throw when the key doesn't exist.
 */

import type { LearnerId } from "../domain/ids";
import {
  isLearnerProfile,
  PROFILE_VERSION,
  type LearnerProfile,
} from "../domain/profile";
import {
  isLearningEvent,
  LEARNING_EVENT_VERSION,
  type LearningEvent,
} from "../events/types";
import {
  EVENT_STORE_KEY_FOR,
  STORAGE_KEYS,
} from "./keys";
import {
  LEARNER_REPOSITORY_ERROR_CODES,
  LearnerRepositoryError,
  type LearnerEventStore,
  type LearnerProfileRepository,
} from "./types";

// ---------------------------------------------------------------------------
// Injectable storage shape
// ---------------------------------------------------------------------------

/**
 * The subset of the Web Storage API this package uses.
 *
 * globalThis.localStorage and globalThis.sessionStorage both
 * satisfy this shape by construction.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveBrowserStorage(): StorageLike {
  if (
    typeof globalThis === "undefined" ||
    typeof (globalThis as { localStorage?: unknown }).localStorage !==
      "object" ||
    (globalThis as { localStorage?: unknown }).localStorage === null
  ) {
    throw new LearnerRepositoryError(
      "localStorage is not available in this environment.",
      LEARNER_REPOSITORY_ERROR_CODES.storageUnavailable,
    );
  }
  return (globalThis as unknown as { localStorage: StorageLike })
    .localStorage;
}

// ---------------------------------------------------------------------------
// Envelope shapes on disk
// ---------------------------------------------------------------------------

interface ProfileEnvelope {
  readonly schema: "prism.learner.profile";
  readonly schemaVersion: typeof PROFILE_VERSION;
  readonly profile: LearnerProfile;
}

interface EventLogEnvelope {
  readonly schema: "prism.learner.eventLog";
  readonly schemaVersion: typeof LEARNING_EVENT_VERSION;
  readonly events: readonly LearningEvent[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new LearnerRepositoryError(
      `Failed to parse stored JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
      LEARNER_REPOSITORY_ERROR_CODES.parseError,
      { rawLength: raw.length },
    );
  }
}

function safeWrite(
  storage: StorageLike,
  key: string,
  serialized: string,
): void {
  try {
    storage.setItem(key, serialized);
  } catch (err) {
    // The Web Storage spec surfaces quota errors as a DOMException
    // with name "QuotaExceededError" (Chrome/Edge/Firefox) or
    // "NS_ERROR_DOM_QUOTA_REACHED" (old Firefox). We normalize.
    const name =
      err &&
      typeof err === "object" &&
      "name" in err &&
      typeof (err as { name?: unknown }).name === "string"
        ? (err as { name: string }).name
        : "";
    const isQuota = name.toLowerCase().includes("quota");
    throw new LearnerRepositoryError(
      isQuota
        ? "Storage quota exceeded."
        : `Failed to write to storage: ${
            err instanceof Error ? err.message : String(err)
          }`,
      isQuota
        ? LEARNER_REPOSITORY_ERROR_CODES.quotaExceeded
        : LEARNER_REPOSITORY_ERROR_CODES.storageUnavailable,
    );
  }
}

// ---------------------------------------------------------------------------
// LocalStorageLearnerProfileRepository
// ---------------------------------------------------------------------------

export class LocalStorageLearnerProfileRepository
  implements LearnerProfileRepository
{
  private readonly _storage: StorageLike;

  constructor(storage: StorageLike = resolveBrowserStorage()) {
    this._storage = storage;
  }

  async load(): Promise<LearnerProfile | null> {
    const raw = this._storage.getItem(STORAGE_KEYS.activeProfile);
    if (raw === null) return null;

    const parsed = safeParse(raw) as Partial<ProfileEnvelope> | null;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.schema !== "prism.learner.profile"
    ) {
      throw new LearnerRepositoryError(
        "Stored profile envelope is malformed.",
        LEARNER_REPOSITORY_ERROR_CODES.parseError,
      );
    }
    if (parsed.schemaVersion !== PROFILE_VERSION) {
      throw new LearnerRepositoryError(
        `Stored profile schemaVersion ${String(
          parsed.schemaVersion,
        )} is not supported by this build (expected ${PROFILE_VERSION}).`,
        LEARNER_REPOSITORY_ERROR_CODES.unsupportedVersion,
        { storedVersion: parsed.schemaVersion },
      );
    }
    if (!isLearnerProfile(parsed.profile)) {
      throw new LearnerRepositoryError(
        "Stored profile payload failed the LearnerProfile shape check.",
        LEARNER_REPOSITORY_ERROR_CODES.invalidPayload,
      );
    }
    return parsed.profile;
  }

  async save(profile: LearnerProfile): Promise<void> {
    if (!isLearnerProfile(profile)) {
      throw new LearnerRepositoryError(
        "Refusing to save: profile failed the LearnerProfile shape check.",
        LEARNER_REPOSITORY_ERROR_CODES.invalidPayload,
      );
    }
    const envelope: ProfileEnvelope = {
      schema: "prism.learner.profile",
      schemaVersion: PROFILE_VERSION,
      profile,
    };
    safeWrite(
      this._storage,
      STORAGE_KEYS.activeProfile,
      JSON.stringify(envelope),
    );
  }

  async reset(): Promise<void> {
    this._storage.removeItem(STORAGE_KEYS.activeProfile);
  }
}

// ---------------------------------------------------------------------------
// LocalStorageLearnerEventStore
// ---------------------------------------------------------------------------

export class LocalStorageLearnerEventStore implements LearnerEventStore {
  private readonly _storage: StorageLike;

  constructor(storage: StorageLike = resolveBrowserStorage()) {
    this._storage = storage;
  }

  async append(event: LearningEvent): Promise<void> {
    if (!isLearningEvent(event)) {
      throw new LearnerRepositoryError(
        "Refusing to append: event failed the LearningEvent shape check.",
        LEARNER_REPOSITORY_ERROR_CODES.invalidPayload,
      );
    }
    const existing = await this.loadForLearner(event.learnerId);
    const next: readonly LearningEvent[] = [...existing, event];
    this._writeLog(event.learnerId, next);
  }

  async loadForLearner(
    learnerId: LearnerId,
  ): Promise<readonly LearningEvent[]> {
    const key = EVENT_STORE_KEY_FOR(learnerId);
    const raw = this._storage.getItem(key);
    if (raw === null) return [];

    const parsed = safeParse(raw) as Partial<EventLogEnvelope> | null;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.schema !== "prism.learner.eventLog"
    ) {
      throw new LearnerRepositoryError(
        "Stored event-log envelope is malformed.",
        LEARNER_REPOSITORY_ERROR_CODES.parseError,
      );
    }
    if (parsed.schemaVersion !== LEARNING_EVENT_VERSION) {
      throw new LearnerRepositoryError(
        `Stored event-log schemaVersion ${String(
          parsed.schemaVersion,
        )} is not supported by this build (expected ${LEARNING_EVENT_VERSION}).`,
        LEARNER_REPOSITORY_ERROR_CODES.unsupportedVersion,
        { storedVersion: parsed.schemaVersion },
      );
    }
    if (!Array.isArray(parsed.events)) {
      throw new LearnerRepositoryError(
        "Stored event-log payload has no events array.",
        LEARNER_REPOSITORY_ERROR_CODES.invalidPayload,
      );
    }
    // Validate every event. Rejecting the entire log on a single
    // bad event is intentional: silent partial reads would let
    // downstream projections drift out of sync.
    for (const ev of parsed.events) {
      if (!isLearningEvent(ev)) {
        throw new LearnerRepositoryError(
          "Stored event-log contains an entry that failed the LearningEvent shape check.",
          LEARNER_REPOSITORY_ERROR_CODES.invalidPayload,
        );
      }
    }
    return parsed.events;
  }

  async clearForLearner(learnerId: LearnerId): Promise<void> {
    this._storage.removeItem(EVENT_STORE_KEY_FOR(learnerId));
  }

  // ---- internal ------------------------------------------------------------

  private _writeLog(
    learnerId: LearnerId,
    events: readonly LearningEvent[],
  ): void {
    const envelope: EventLogEnvelope = {
      schema: "prism.learner.eventLog",
      schemaVersion: LEARNING_EVENT_VERSION,
      events,
    };
    safeWrite(
      this._storage,
      EVENT_STORE_KEY_FOR(learnerId),
      JSON.stringify(envelope),
    );
  }
}