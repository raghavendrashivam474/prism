import { describe, it, expect } from "vitest";
import { LearningIrV01Ingestor, TraceIngestionError } from "../ingestor";

// ---------------------------------------------------------------------------
// Fixture: the Sprint 0 arithmetic trace
// ---------------------------------------------------------------------------

const ARITHMETIC_TRACE = {
  irVersion: "0.1",
  executionId: "test-exec",
  languageId: "cpp",
  events: [
    { irVersion: "0.1", sequence: 1, type: "execution.started",   source: { line: 1 }, entityId: null, payload: {} },
    { irVersion: "0.1", sequence: 2, type: "scope.entered",       source: { line: 1 }, entityId: null, payload: { scopeId: "scope_main_1", displayName: "main" } },
    { irVersion: "0.1", sequence: 3, type: "entity.created",      source: { line: 2 }, entityId: "var_x_1", payload: { kind: "variable", displayName: "x", dataType: "int", value: 10, scopeId: "scope_main_1" } },
    { irVersion: "0.1", sequence: 4, type: "entity.value_changed", source: { line: 3 }, entityId: "var_x_1", payload: { previousValue: 10, value: 20 } },
    { irVersion: "0.1", sequence: 5, type: "entity.value_changed", source: { line: 4 }, entityId: "var_x_1", payload: { previousValue: 20, value: 25 } },
    { irVersion: "0.1", sequence: 6, type: "scope.exited",        source: { line: 6 }, entityId: null, payload: { scopeId: "scope_main_1", displayName: "main" } },
    { irVersion: "0.1", sequence: 7, type: "execution.completed", source: { line: 6 }, entityId: null, payload: {} },
  ],
};

const FAILURE_TRACE = {
  irVersion: "0.1",
  executionId: "test-exec",
  languageId: "cpp",
  events: [
    {
      irVersion: "0.1",
      sequence: 1,
      type: "execution.failed",
      source: { line: 1 },
      entityId: null,
      payload: {
        category: "unsupported_profile",
        message: "Loops are not supported.",
        diagnostics: [],
        violations: [{ code: "CPP_PROFILE_LOOP_UNSUPPORTED", line: 3, message: "Loops are not supported." }],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LearningIrV01Ingestor", () => {
  const ingestor = new LearningIrV01Ingestor();

  describe("valid ingestion", () => {
    it("ingests the arithmetic trace without error", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      expect(trace.events).toHaveLength(7);
    });

    it("preserves irVersion", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      expect(trace.irVersion).toBe("0.1");
    });

    it("preserves executionId", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      expect(trace.executionId).toBe("test-exec");
    });

    it("preserves languageId", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      expect(trace.languageId).toBe("cpp");
    });

    it("maps execution.started correctly", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      const event = trace.events[0];
      expect(event.type).toBe("execution.started");
      expect(event.sequence).toBe(1);
      expect(event.sourceLocation.line).toBe(1);
    });

    it("maps scope.entered correctly", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      const event = trace.events[1];
      expect(event.type).toBe("scope.entered");
      expect(event.payload.kind).toBe("scope.entered");
      if (event.payload.kind === "scope.entered") {
        expect(event.payload.displayName).toBe("main");
        expect(event.payload.scopeId).toBe("scope_main_1");
      }
    });

    it("maps entity.created correctly", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      const event = trace.events[2];
      expect(event.type).toBe("entity.created");
      expect(event.entityId).toBe("var_x_1");
      if (event.payload.kind === "entity.created") {
        expect(event.payload.displayName).toBe("x");
        expect(event.payload.dataType).toBe("int");
        expect(event.payload.value).toBe(10);
      }
    });

    it("maps entity.value_changed correctly", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      const event = trace.events[3];
      expect(event.type).toBe("entity.value_changed");
      if (event.payload.kind === "entity.value_changed") {
        expect(event.payload.previousValue).toBe(10);
        expect(event.payload.value).toBe(20);
      }
    });

    it("maps execution.completed correctly", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      const event = trace.events[6];
      expect(event.type).toBe("execution.completed");
    });

    it("maps execution.failed correctly", () => {
      const trace = ingestor.ingest(FAILURE_TRACE);
      const event = trace.events[0];
      expect(event.type).toBe("execution.failed");
      if (event.payload.kind === "execution.failed") {
        expect(event.payload.category).toBe("unsupported_profile");
        expect(event.payload.violations).toHaveLength(1);
        expect(event.payload.violations[0].line).toBe(3);
      }
    });

    it("maps source locations onto each event", () => {
      const trace = ingestor.ingest(ARITHMETIC_TRACE);
      expect(trace.events[2].sourceLocation.line).toBe(2);
      expect(trace.events[3].sourceLocation.line).toBe(3);
      expect(trace.events[4].sourceLocation.line).toBe(4);
    });

    it("ingests an empty events array", () => {
      const trace = ingestor.ingest({ irVersion: "0.1", executionId: "", languageId: "cpp", events: [] });
      expect(trace.events).toHaveLength(0);
    });
  });

  describe("version validation", () => {
    it("rejects unsupported irVersion", () => {
      expect(() =>
        ingestor.ingest({ ...ARITHMETIC_TRACE, irVersion: "0.2" }),
      ).toThrow(TraceIngestionError);
    });

    it("rejects missing irVersion", () => {
      const { irVersion: _, ...rest } = ARITHMETIC_TRACE;
      expect(() => ingestor.ingest(rest)).toThrow(TraceIngestionError);
    });

    it("error code is UNSUPPORTED_IR_VERSION", () => {
      try {
        ingestor.ingest({ ...ARITHMETIC_TRACE, irVersion: "2.0" });
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(TraceIngestionError);
        expect((e as TraceIngestionError).code).toBe("UNSUPPORTED_IR_VERSION");
      }
    });
  });

  describe("sequence validation", () => {
    it("rejects a gap in sequences", () => {
      const broken = {
        ...ARITHMETIC_TRACE,
        events: [
          ARITHMETIC_TRACE.events[0],
          { ...ARITHMETIC_TRACE.events[2], sequence: 3 }, // skips 2
        ],
      };
      expect(() => ingestor.ingest(broken)).toThrow(TraceIngestionError);
    });

    it("rejects duplicate sequences", () => {
      const broken = {
        ...ARITHMETIC_TRACE,
        events: [
          ARITHMETIC_TRACE.events[0],
          { ...ARITHMETIC_TRACE.events[0], sequence: 1 }, // duplicate
        ],
      };
      expect(() => ingestor.ingest(broken)).toThrow(TraceIngestionError);
    });

    it("error code is SEQUENCE_GAP", () => {
      const broken = {
        ...ARITHMETIC_TRACE,
        events: [
          ARITHMETIC_TRACE.events[0],
          { ...ARITHMETIC_TRACE.events[1], sequence: 5 },
        ],
      };
      try {
        ingestor.ingest(broken);
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as TraceIngestionError).code).toBe("SEQUENCE_GAP");
      }
    });
  });

  describe("structural validation", () => {
    it("rejects null input", () => {
      expect(() => ingestor.ingest(null)).toThrow(TraceIngestionError);
    });

    it("rejects non-object input", () => {
      expect(() => ingestor.ingest("not an object")).toThrow(TraceIngestionError);
    });

    it("rejects trace with no events array", () => {
      expect(() =>
        ingestor.ingest({ irVersion: "0.1", executionId: "", languageId: "cpp" }),
      ).toThrow(TraceIngestionError);
    });

    it("rejects unsupported event type", () => {
      const broken = {
        ...ARITHMETIC_TRACE,
        events: [
          { sequence: 1, type: "unknown.event.type", source: { line: 1 }, payload: {} },
        ],
      };
      expect(() => ingestor.ingest(broken)).toThrow(TraceIngestionError);
    });

    it("rejects event with invalid source line", () => {
      const broken = {
        ...ARITHMETIC_TRACE,
        events: [
          { sequence: 1, type: "execution.started", source: { line: 0 }, payload: {} },
        ],
      };
      expect(() => ingestor.ingest(broken)).toThrow(TraceIngestionError);
    });
  });
});