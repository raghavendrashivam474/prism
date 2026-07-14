/**
 * Learning IR v0.1 Ingestor.
 *
 * Validates and maps raw API JSON into the frontend NormalizedTrace model.
 *
 * The visual state engine must never receive `unknown`.
 * This is the validation and mapping boundary.
 */

import type {
  NormalizedTrace,
  NormalizedTraceEvent,
  TraceEventType,
  TraceEventPayload,
  SourceLocation,
} from "./types";

const SUPPORTED_IR_VERSION = "0.1";

const SUPPORTED_EVENT_TYPES = new Set<string>([
  "execution.started",
  "scope.entered",
  "scope.exited",
  "entity.created",
  "entity.value_changed",
  "execution.completed",
  "execution.failed",
]);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TraceIngestionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "TraceIngestionError";
  }
}

// ---------------------------------------------------------------------------
// Payload mapper
// ---------------------------------------------------------------------------

function mapPayload(type: string, raw: Record<string, unknown>): TraceEventPayload {
  switch (type) {
    case "execution.started":
      return { kind: "execution.started" };

    case "scope.entered":
      return {
        kind: "scope.entered",
        scopeId: String(raw["scopeId"] ?? ""),
        displayName: String(raw["displayName"] ?? ""),
      };

    case "scope.exited":
      return {
        kind: "scope.exited",
        scopeId: String(raw["scopeId"] ?? ""),
        displayName: String(raw["displayName"] ?? ""),
      };

    case "entity.created":
      return {
        kind: "entity.created",
        entityKind: "variable",
        displayName: String(raw["displayName"] ?? ""),
        dataType: String(raw["dataType"] ?? ""),
        value: Number(raw["value"] ?? 0),
        scopeId: String(raw["scopeId"] ?? ""),
      };

    case "entity.value_changed":
      return {
        kind: "entity.value_changed",
        previousValue: Number(raw["previousValue"] ?? 0),
        value: Number(raw["value"] ?? 0),
      };

    case "execution.completed":
      return { kind: "execution.completed" };

    case "execution.failed":
      return {
        kind: "execution.failed",
        category: String(raw["category"] ?? "internal_error"),
        message: String(raw["message"] ?? ""),
        diagnostics: Array.isArray(raw["diagnostics"])
          ? (raw["diagnostics"] as unknown[]).map(String)
          : [],
        violations: Array.isArray(raw["violations"])
          ? (raw["violations"] as Record<string, unknown>[]).map((v) => ({
              code: String(v["code"] ?? ""),
              line: v["line"] != null ? Number(v["line"]) : null,
              message: String(v["message"] ?? ""),
            }))
          : [],
      };

    default:
      throw new TraceIngestionError(
        `Unsupported event type: ${type}`,
        "UNSUPPORTED_EVENT_TYPE",
        { type },
      );
  }
}

// ---------------------------------------------------------------------------
// Event mapper
// ---------------------------------------------------------------------------

function mapEvent(raw: unknown, index: number): NormalizedTraceEvent {
  if (typeof raw !== "object" || raw === null) {
    throw new TraceIngestionError(
      `Event at index ${index} is not an object`,
      "INVALID_EVENT_SHAPE",
      { index, raw },
    );
  }

  const obj = raw as Record<string, unknown>;

  const sequence = Number(obj["sequence"]);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new TraceIngestionError(
      `Event at index ${index} has invalid sequence: ${obj["sequence"]}`,
      "INVALID_SEQUENCE",
      { index, sequence: obj["sequence"] },
    );
  }

  const type = String(obj["type"] ?? "");
  if (!SUPPORTED_EVENT_TYPES.has(type)) {
    throw new TraceIngestionError(
      `Event at index ${index} has unsupported type: ${type}`,
      "UNSUPPORTED_EVENT_TYPE",
      { index, type },
    );
  }

  const sourceObj = obj["source"];
  if (typeof sourceObj !== "object" || sourceObj === null) {
    throw new TraceIngestionError(
      `Event at index ${index} has missing or invalid source location`,
      "INVALID_SOURCE_LOCATION",
      { index },
    );
  }

  const line = Number((sourceObj as Record<string, unknown>)["line"]);
  if (!Number.isInteger(line) || line < 1) {
    throw new TraceIngestionError(
      `Event at index ${index} has invalid source line: ${line}`,
      "INVALID_SOURCE_LINE",
      { index, line },
    );
  }

  const sourceLocation: SourceLocation = { line };

  const payloadRaw =
    typeof obj["payload"] === "object" && obj["payload"] !== null
      ? (obj["payload"] as Record<string, unknown>)
      : {};

  const payload = mapPayload(type, payloadRaw);

  const entityId =
    typeof obj["entityId"] === "string" ? obj["entityId"] : undefined;

  return {
    sequence,
    type: type as TraceEventType,
    sourceLocation,
    entityId,
    payload,
  };
}

// ---------------------------------------------------------------------------
// Public ingestor
// ---------------------------------------------------------------------------

export interface TraceIngestor {
  ingest(input: unknown): NormalizedTrace;
}

export class LearningIrV01Ingestor implements TraceIngestor {
  ingest(input: unknown): NormalizedTrace {
    if (typeof input !== "object" || input === null) {
      throw new TraceIngestionError(
        "Input is not an object",
        "INVALID_TRACE_SHAPE",
        { input },
      );
    }

    const obj = input as Record<string, unknown>;

    // Version check
    const irVersion = String(obj["irVersion"] ?? "");
    if (irVersion !== SUPPORTED_IR_VERSION) {
      throw new TraceIngestionError(
        `Unsupported irVersion: "${irVersion}". Expected "${SUPPORTED_IR_VERSION}".`,
        "UNSUPPORTED_IR_VERSION",
        { irVersion },
      );
    }

    // Events collection
    if (!Array.isArray(obj["events"])) {
      throw new TraceIngestionError(
        "Trace has no events array",
        "MISSING_EVENTS",
      );
    }

    const rawEvents = obj["events"] as unknown[];
    const events: NormalizedTraceEvent[] = rawEvents.map((e, i) =>
      mapEvent(e, i),
    );

    // Sequence validation
    for (let i = 0; i < events.length; i++) {
      const expected = i + 1;
      if (events[i].sequence !== expected) {
        throw new TraceIngestionError(
          `Sequence gap at index ${i}: expected ${expected}, got ${events[i].sequence}`,
          "SEQUENCE_GAP",
          { index: i, expected, actual: events[i].sequence },
        );
      }
    }

    return {
      irVersion,
      executionId: String(obj["executionId"] ?? ""),
      languageId: String(obj["languageId"] ?? ""),
      events,
    };
  }
}