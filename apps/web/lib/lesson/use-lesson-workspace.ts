/**
 * Lesson workspace state hook - Milestone 2.13b.
 *
 * Wires together every Sprint 2 domain package to run a full lesson
 * experience in the browser:
 *
 *   1. Loads the lesson via StaticLessonLoader
 *   2. Owns a LessonSessionState via useReducer
 *   3. Owns the current attempt's PrismExecutionResult
 *   4. Owns the current attempt's LearnerFeedback
 *   5. Owns the timeline controller for evidence navigation
 *
 * The hook does NOT contain domain logic. Every transition is
 * delegated to the pure functions in @prism/lessons. React holds
 * the current state; the domain decides transitions.
 *
 * Boundaries preserved:
 *   - No lesson progression logic in this hook (session engine owns it)
 *   - No objective evaluation in this hook (evaluator plugins own it)
 *   - No feedback wording in this hook (feedback projector owns it)
 *   - No trace ingestion in this hook (ExecutionRunner owns it)
 *   - No timeline mechanics in this hook (SnapshotTimelineController owns it)
 */

"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import type { TimelineController } from "@prism/timeline";
import { linkEvidence } from "@prism/timeline";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import type { PrismExecutionResult } from "@prism/execution-result";
import { pendingPrismExecutionResult } from "@prism/execution-result";
import {
  startSession,
  activateStep,
  recordAttempt,
  resetSession,
  currentStepState,
  isLessonComplete,
  toExecutionOutcome,
  projectStepFeedback,
  type LessonDefinition,
  type LessonSessionState,
  type LessonStepDefinition,
  type LessonStepState,
  type LearnerFeedback,
  type ExecutionOutcome,
} from "@prism/lessons";
import type { ExecutionRunner } from "../execution/runner";
import type { ObjectiveEvaluatorRegistry } from "@prism/objectives";
import { getLessonLoader } from "./lesson-registry";

type SessionAction =
  | { type: "start"; lesson: LessonDefinition }
  | { type: "reset"; lesson: LessonDefinition }
  | { type: "activate"; stepId: string }
  | {
      type: "recordAttempt";
      lesson: LessonDefinition;
      source: string;
      outcome: ExecutionOutcome;
      registry: ObjectiveEvaluatorRegistry;
    };

function sessionReducer(
  state: LessonSessionState | null,
  action: SessionAction,
): LessonSessionState | null {
  switch (action.type) {
    case "start":
      return startSession(action.lesson);
    case "reset":
      return resetSession(action.lesson);
    case "activate":
      if (state === null) return state;
      return activateStep(state, action.stepId);
    case "recordAttempt":
      if (state === null) return state;
      return recordAttempt(
        state,
        action.lesson,
        {
          source: action.source,
          outcome: action.outcome,
          now: () => new Date().toISOString(),
        },
        action.registry,
      );
  }
}

export interface UseLessonWorkspaceInput {
  readonly lessonId: string;
  readonly runner: ExecutionRunner;
  readonly registry: ObjectiveEvaluatorRegistry;
}

export interface UseLessonWorkspaceOutput {
  readonly lesson: LessonDefinition | null;
  readonly lessonError: string | null;

  readonly session: LessonSessionState | null;
  readonly activeStep: LessonStepDefinition | null;
  readonly activeStepState: LessonStepState | null;
  readonly lessonComplete: boolean;
  readonly canExecute: boolean;

  readonly source: string;
  setSource(next: string): void;

  readonly isExecuting: boolean;
  readonly result: PrismExecutionResult;
  readonly timeline: TimelineController;
  readonly currentSnapshot: VisualStateSnapshot | null;
  readonly feedback: LearnerFeedback | null;

  execute(): Promise<void>;
  continueToStep(stepId: string): void;
  resetLesson(): void;
  jumpToEvidence(sequence: number): void;
  navigateTimeline(
    action: "next" | "previous" | "first" | "last" | number,
  ): void;
}

export function useLessonWorkspace(
  input: UseLessonWorkspaceInput,
): UseLessonWorkspaceOutput {
  const [lesson, setLesson] = useState<LessonDefinition | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [session, dispatch] = useReducer(sessionReducer, null);

  const [source, setSource] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<PrismExecutionResult>(
    pendingPrismExecutionResult(),
  );
  const [timeline, setTimeline] = useState<TimelineController>(
    result.timeline,
  );
  const [feedback, setFeedback] = useState<LearnerFeedback | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLessonError(null);
    getLessonLoader()
      .load(input.lessonId)
      .then((loaded) => {
        if (cancelled) return;
        setLesson(loaded);
        dispatch({ type: "start", lesson: loaded });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLessonError(
          err instanceof Error ? err.message : "Failed to load lesson.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [input.lessonId]);

  const activeStepState = session ? currentStepState(session) : null;
  const activeStep: LessonStepDefinition | null =
    lesson && activeStepState
      ? lesson.steps.find((s) => s.id === activeStepState.stepId) ?? null
      : null;

  useEffect(() => {
    if (activeStep !== null) {
      setSource(activeStep.code.starterSource);
      const pending = pendingPrismExecutionResult();
      setResult(pending);
      setTimeline(pending.timeline);
      setFeedback(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep?.id]);

  const lessonComplete = session ? isLessonComplete(session) : false;

  // canExecute mirrors the recordAttempt domain rule: attempts can only
  // be recorded against a step whose status is "active". If the current
  // step is already completed (learner satisfied it but has not clicked
  // Continue yet), Run is disabled until they advance.
  const canExecute: boolean =
    lesson !== null &&
    session !== null &&
    activeStep !== null &&
    activeStepState !== null &&
    activeStepState.status === "active" &&
    !lessonComplete &&
    !isExecuting;

  const execute = useCallback(async () => {
    // Defensive guard: even if canExecute drifts out of sync with the
    // button's disabled prop (e.g. a stale render), we must not dispatch
    // recordAttempt against a non-active step. The domain would throw
    // NO_ACTIVE_STEP and crash the React tree.
    if (isExecuting) return;
    if (lesson === null || activeStep === null || session === null) return;
    if (activeStepState === null || activeStepState.status !== "active") return;

    setIsExecuting(true);
    try {
      const nextResult = await input.runner.execute({
        languageId: lesson.languageId,
        source,
      });
      setResult(nextResult);
      setTimeline(nextResult.timeline);

      const outcome = toExecutionOutcome(nextResult);
      if (outcome !== null) {
        dispatch({
          type: "recordAttempt",
          lesson,
          source,
          outcome,
          registry: input.registry,
        });
      }
    } finally {
      setIsExecuting(false);
    }
  }, [
    isExecuting,
    lesson,
    activeStep,
    activeStepState,
    session,
    source,
    input.runner,
    input.registry,
  ]);

  useEffect(() => {
    if (session === null || activeStep === null) {
      setFeedback(null);
      return;
    }
    const stepState = currentStepState(session);
    if (stepState === null || stepState.attempts.length === 0) {
      setFeedback(null);
      return;
    }
    const latest = stepState.attempts[stepState.attempts.length - 1];
    setFeedback(projectStepFeedback(activeStep, latest.evaluation));
  }, [session, activeStep]);

  const continueToStep = useCallback((stepId: string) => {
    dispatch({ type: "activate", stepId });
  }, []);

  const resetLesson = useCallback(() => {
    if (lesson === null) return;
    dispatch({ type: "reset", lesson });
    const pending = pendingPrismExecutionResult();
    setResult(pending);
    setTimeline(pending.timeline);
    setFeedback(null);
  }, [lesson]);

  const jumpToEvidence = useCallback(
    (sequence: number) => {
      const linked = linkEvidence(result.snapshots, { sequence });
      if (linked.kind !== "resolved") return;
      setTimeline((prev) => prev.select(linked.snapshotIndex));
    },
    [result.snapshots],
  );

  const navigateTimeline = useCallback(
    (action: "next" | "previous" | "first" | "last" | number) => {
      setTimeline((prev) => {
        if (typeof action === "number") return prev.select(action);
        switch (action) {
          case "next": return prev.next();
          case "previous": return prev.previous();
          case "first": return prev.first();
          case "last": return prev.last();
        }
      });
    },
    [],
  );

  const currentSnapshot: VisualStateSnapshot | null =
    timeline.currentSnapshot ?? result.snapshots[0] ?? null;

  return {
    lesson,
    lessonError,
    session,
    activeStep,
    activeStepState,
    lessonComplete,
    canExecute,
    source,
    setSource,
    isExecuting,
    result,
    timeline,
    currentSnapshot,
    feedback,
    execute,
    continueToStep,
    resetLesson,
    jumpToEvidence,
    navigateTimeline,
  };
}