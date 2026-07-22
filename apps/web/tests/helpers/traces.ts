/**
 * Canned learning IR traces for each of the four steps of the
 * Understanding Variable State lesson.
 *
 * Shape matches what /api/v1/executions returns (validated against
 * packages/trace-model/src/ingestor.ts):
 *
 *   {
 *     irVersion: "0.1",
 *     executionId: string,
 *     languageId: "cpp",
 *     events: [
 *       {
 *         irVersion: "0.1",
 *         sequence: N (1-based, contiguous),
 *         type: string,
 *         source: { line: N },
 *         entityId?: string,
 *         payload: {...},
 *       },
 *       ...
 *     ]
 *   }
 *
 * Each fixture represents the successful attempt on one step. The
 * mock-execution helper dispatches the right one based on source
 * code content.
 */

export interface RawTrace {
  irVersion: string;
  executionId: string;
  languageId: string;
  events: RawTraceEvent[];
}

export interface RawTraceEvent {
  irVersion: string;
  sequence: number;
  type: string;
  source: { line: number };
  entityId?: string;
  payload: Record<string, unknown>;
}

function baseFramingEvents(sequence: { current: number }): RawTraceEvent[] {
  const started: RawTraceEvent = {
    irVersion: "0.1",
    sequence: sequence.current++,
    type: "execution.started",
    source: { line: 1 },
    payload: {},
  };
  const scopeEntered: RawTraceEvent = {
    irVersion: "0.1",
    sequence: sequence.current++,
    type: "scope.entered",
    source: { line: 1 },
    payload: { scopeId: "main", displayName: "main" },
  };
  return [started, scopeEntered];
}

function closingFramingEvents(sequence: { current: number }): RawTraceEvent[] {
  const scopeExited: RawTraceEvent = {
    irVersion: "0.1",
    sequence: sequence.current++,
    type: "scope.exited",
    source: { line: 4 },
    payload: { scopeId: "main", displayName: "main" },
  };
  const executionCompleted: RawTraceEvent = {
    irVersion: "0.1",
    sequence: sequence.current++,
    type: "execution.completed",
    source: { line: 4 },
    payload: {},
  };
  return [scopeExited, executionCompleted];
}

/**
 * Step 1 satisfying trace: int x = 10;
 *
 * Events:
 *   1. execution.started
 *   2. scope.entered main
 *   3. entity.created x = 10 (line 2)
 *   4. scope.exited main
 *   5. execution.completed
 */
export function traceForStep1Success(): RawTrace {
  const seq = { current: 1 };
  const framing = baseFramingEvents(seq);
  const created: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "entity.created",
    source: { line: 2 },
    entityId: "var_x_1",
    payload: {
      entityKind: "variable",
      displayName: "x",
      dataType: "int",
      value: 10,
      scopeId: "main",
    },
  };
  const closing = closingFramingEvents(seq);
  return {
    irVersion: "0.1",
    executionId: "test-step1",
    languageId: "cpp",
    events: [...framing, created, ...closing],
  };
}

/**
 * Step 2 satisfying trace: int x = 10; x = 20;
 *
 * Adds a value_changed event 10 -> 20 on line 3.
 */
export function traceForStep2Success(): RawTrace {
  const seq = { current: 1 };
  const framing = baseFramingEvents(seq);
  const created: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "entity.created",
    source: { line: 2 },
    entityId: "var_x_1",
    payload: {
      entityKind: "variable",
      displayName: "x",
      dataType: "int",
      value: 10,
      scopeId: "main",
    },
  };
  const changed: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "entity.value_changed",
    source: { line: 3 },
    entityId: "var_x_1",
    payload: {
      previousValue: 10,
      value: 20,
    },
  };
  const closing = closingFramingEvents(seq);
  return {
    irVersion: "0.1",
    executionId: "test-step2",
    languageId: "cpp",
    events: [...framing, created, changed, ...closing],
  };
}

/**
 * Step 3 satisfying trace: int x = 10; x = x + 5;
 *
 * Adds a value_changed event 10 -> 15 on line 3.
 */
export function traceForStep3Success(): RawTrace {
  const seq = { current: 1 };
  const framing = baseFramingEvents(seq);
  const created: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "entity.created",
    source: { line: 2 },
    entityId: "var_x_1",
    payload: {
      entityKind: "variable",
      displayName: "x",
      dataType: "int",
      value: 10,
      scopeId: "main",
    },
  };
  const changed: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "entity.value_changed",
    source: { line: 3 },
    entityId: "var_x_1",
    payload: {
      previousValue: 10,
      value: 15,
    },
  };
  const closing = closingFramingEvents(seq);
  return {
    irVersion: "0.1",
    executionId: "test-step3",
    languageId: "cpp",
    events: [...framing, created, changed, ...closing],
  };
}

/**
 * Step 4 satisfying trace: int x = 10; x = 20; x = 30;
 *
 * Adds two consecutive value_changed events:
 *   10 -> 20 on line 3
 *   20 -> 30 on line 4
 */
export function traceForStep4Success(): RawTrace {
  const seq = { current: 1 };
  const framing = baseFramingEvents(seq);
  const created: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "entity.created",
    source: { line: 2 },
    entityId: "var_x_1",
    payload: {
      entityKind: "variable",
      displayName: "x",
      dataType: "int",
      value: 10,
      scopeId: "main",
    },
  };
  const changed1: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "entity.value_changed",
    source: { line: 3 },
    entityId: "var_x_1",
    payload: {
      previousValue: 10,
      value: 20,
    },
  };
  const changed2: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "entity.value_changed",
    source: { line: 4 },
    entityId: "var_x_1",
    payload: {
      previousValue: 20,
      value: 30,
    },
  };
  // Closing framing at line 5 for the 5-line step-4 program
  const scopeExited: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "scope.exited",
    source: { line: 5 },
    payload: { scopeId: "main", displayName: "main" },
  };
  const executionCompleted: RawTraceEvent = {
    irVersion: "0.1",
    sequence: seq.current++,
    type: "execution.completed",
    source: { line: 5 },
    payload: {},
  };
  return {
    irVersion: "0.1",
    executionId: "test-step4",
    languageId: "cpp",
    events: [...framing, created, changed1, changed2, scopeExited, executionCompleted],
  };
}