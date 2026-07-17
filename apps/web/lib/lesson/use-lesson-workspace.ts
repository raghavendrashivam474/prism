/**
 * Lesson workspace state hook.
 *
 * Wires together every Sprint 2 domain package to run a full lesson
 * experience in the browser:
 *
 *   1. Loads the lesson via StaticLessonLoader
 *   2. Owns a LessonSessionState via useReducer
 *   3. Owns the current attempt's PrismExecutionResult
 *   4. Owns the current attempt's LearnerFeedback
 *   5. Owns the timeline controller for evidence navigation
 *   6. Owns the WorkspaceMode (active | review) - Milestone 2.15
 *
 * The hook does NOT contain domain logic. Every transition is
 * delegated to the pure functions in @prism/lessons. React holds
 * the current state; the domain decides transitions.
 *
 * Workspace modes (Milestone 2.15):
 *
 *   active  - the normal experience. Editor is writable, Run works,
 *             feedback is for the currently-active attempt.
 *   review  - the learner is inspecting a completed step's last
 *             attempt. Editor is read-only and shows the reviewed
 *             attempt's source, feedback shows that attempt's
 *             evaluation, and the timeline is populated from that
 *             attempt's snapshots. Run is disabled.
 *
 * Reviewing derives from session state. We only track the reviewingStepId;
 * everything else (result, timeline, feedback) is computed from the
 * canonical LessonSessionState. This avoids duplicating attempt data.
 *
 * Boundaries preserved:
 *   - No lesson progression logic in this hook (session engine owns it)
 *   - No objective evaluation in this hook (evaluator plugins own it)
 *   - No feedback wording in this hook (feedback projector owns it)
 *   - No trace ingestion in this hook (ExecutionRunner owns it)
 *   - No timeline mechanics in this hook (SnapshotTimelineController owns it)
 */

"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { TimelineController } from "@prism/timeline";
import { linkEvidence, SnapshotTimelineController } from "@prism/timeline";
import type { VisualStateSnapshot } from "@prism/visual-state-engine";
import type { PrismExecutionResult } from "@prism/execution-result";
import {
  buildSuccessPrismExecutionResult,
  buildFailurePrismExecutionResult,
  pendingPrismExecutionResult,
} from "@prism/execution-result";
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
  type LessonAttempt,
  type LearnerFeedback,
  type ExecutionOutcome,
} from "@prism/lessons";
import type { ExecutionRunner } from "../execution/runner";
import type { ObjectiveEvaluatorRegistry } from "@prism/objectives";
import { getLessonLoader } from "./lesson-registry";

// ---------------------------------------------------------------------------
// Workspace mode (Milestone 2.15)
// ---------------------------------------------------------------------------

/**
 * The learner's current interaction context inside the workspace.
 *
 * Additional modes may be introduced later (showcase, ai-guided, debug).
 * Prefer the derived isInteractive flag when a component only needs to
 * know whether the workspace should accept edits and Run.
 */
export type LessonWorkspaceMode = "active" | "review";

// ---------------------------------------------------------------------------
// Session reducer
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reconstruct a PrismExecutionResult from a stored LessonAttempt.
 *
 * A LessonAttempt stores the ExecutionOutcome (success or failure) and
 * the full StepEvaluation. To review the attempt, we need to expose a
 * PrismExecutionResult so the same UI pipeline (timeline, snapshots,
 * failure panel) can render it uniformly with the active-mode result.
 */
function reviewedResultFromAttempt(
  attempt: LessonAttempt,
): PrismExecutionResult {
  const outcome = attempt.outcome;
  if (outcome.kind === "success") {
    return buildSuccessPrismExecutionResult({
      trace: outcome.trace,
      snapshots: outcome.snapshots,
    });
  }
  // outcome.kind === "failure"
  return buildFailurePrismExecutionResult({
    failure: {
      category: outcome.category,
      message: outcome.message,
    },
  });
}

// ---------------------------------------------------------------------------
// Public hook API
// ---------------------------------------------------------------------------

export interface UseLessonWorkspaceInput {
  readonly lessonId: string;
  readonly runner: ExecutionRunner;
  readonly registry: ObjectiveEvaluatorRegistry;
}

export interface UseLessonWorkspaceOutput {
  readonly lesson: LessonDefinition | null;
  readonly lessonError: string | null;

  readonly session: LessonSessionState | null;

  // Active step (unchanged in review mode - the "currently working" step)
  readonly activeStep: LessonStepDefinition | null;
  readonly activeStepState: LessonStepState | null;

  // Displayed step: either the active step (in active mode) or the
  // step being reviewed (in review mode). Components should read
  // displayedStep for content rendering.
  readonly displayedStep: LessonStepDefinition | null;
  readonly displayedStepState: LessonStepState | null;

  readonly lessonComplete: boolean;
  readonly canExecute: boolean;

  // Editor source shown to the learner. In review mode this is the
  // reviewed attempt's source; in active mode it is the learner's
  // in-progress source.
  readonly source: string;
  setSource(next: string): void;

  readonly isExecuting: boolean;
  readonly result: PrismExecutionResult;
  readonly timeline: TimelineController;
  readonly currentSnapshot: VisualStateSnapshot | null;
  readonly feedback: LearnerFeedback | null;

  // Workspace mode (Milestone 2.15)
  readonly mode: LessonWorkspaceMode;
  readonly isInteractive: boolean;
  readonly reviewingStepId: string | null;
  enterReviewMode(stepId: string): void;
  exitReviewMode(): void;

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

  // Active-mode source. This is the learner's in-progress code for the
  // currently active step. Preserved across review-mode toggles so
  // returning to the current step restores exactly what they were typing.
  const [activeSource, setActiveSource] = useState("");

  const [isExecuting, setIsExecuting] = useState(false);

  // Active-mode PrismExecutionResult and its timeline. Cleared when the
  // active step changes.
  const [activeResult, setActiveResult] = useState<PrismExecutionResult>(
    pendingPrismExecutionResult(),
  );
  const [activeTimeline, setActiveTimeline] = useState<TimelineController>(
    activeResult.timeline,
  );

  // Review-mode state. reviewingStepId is the only source of truth;
  // reviewTimeline is the navigation position within the reviewed
  // attempt's snapshots.
  const [reviewingStepId, setReviewingStepId] = useState<string | null>(null);
  const [reviewTimeline, setReviewTimeline] = useState<TimelineController>(
    SnapshotTimelineController.empty(),
  );

  // ---- Load lesson ----
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

  // ---- Derive active step ----
  const activeStepState = session ? currentStepState(session) : null;
  const activeStep: LessonStepDefinition | null =
    lesson && activeStepState
      ? lesson.steps.find((s) => s.id === activeStepState.stepId) ?? null
      : null;

  // ---- Reset editor + result when the active step changes ----
  useEffect(() => {
    if (activeStep !== null) {
      setActiveSource(activeStep.code.starterSource);
      const pending = pendingPrismExecutionResult();
      setActiveResult(pending);
      setActiveTimeline(pending.timeline);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep?.id]);

  const lessonComplete = session ? isLessonComplete(session) : false;
  const mode: LessonWorkspaceMode =
    reviewingStepId !== null ? "review" : "active";
  const isInteractive = mode === "active";

  const canExecute: boolean =
    isInteractive &&
    lesson !== null &&
    session !== null &&
    activeStep !== null &&
    activeStepState !== null &&
    activeStepState.status === "active" &&
    !lessonComplete &&
    !isExecuting;

  // ---- Derive review-mode fields ----
  const reviewedStepState: LessonStepState | null = useMemo(() => {
    if (reviewingStepId === null || session === null) return null;
    return (
      session.stepStates.find((s) => s.stepId === reviewingStepId) ?? null
    );
  }, [reviewingStepId, session]);

  const reviewedStep: LessonStepDefinition | null = useMemo(() => {
    if (reviewingStepId === null || lesson === null) return null;
    return lesson.steps.find((s) => s.id === reviewingStepId) ?? null;
  }, [reviewingStepId, lesson]);

  const reviewedAttempt: LessonAttempt | null = useMemo(() => {
    if (reviewedStepState === null) return null;
    if (reviewedStepState.attempts.length === 0) return null;
    return reviewedStepState.attempts[reviewedStepState.attempts.length - 1];
  }, [reviewedStepState]);

  const reviewedResult: PrismExecutionResult | null = useMemo(() => {
    if (reviewedAttempt === null) return null;
    return reviewedResultFromAttempt(reviewedAttempt);
  }, [reviewedAttempt]);

  // Whenever we enter review or the reviewed attempt changes, seed the
  // review timeline from the reviewed result.
  useEffect(() => {
    if (reviewedResult !== null) {
      setReviewTimeline(reviewedResult.timeline);
    }
  }, [reviewedResult]);

  // ---- Displayed values (mode-aware) ----
  const displayedStep: LessonStepDefinition | null =
    mode === "review" ? reviewedStep : activeStep;
  const displayedStepState: LessonStepState | null =
    mode === "review" ? reviewedStepState : activeStepState;

  const source: string =
    mode === "review" ? reviewedAttempt?.source ?? "" : activeSource;

  const result: PrismExecutionResult =
    mode === "review"
      ? reviewedResult ?? pendingPrismExecutionResult()
      : activeResult;

  const timeline: TimelineController =
    mode === "review" ? reviewTimeline : activeTimeline;

  // ---- Feedback ----
  const feedback: LearnerFeedback | null = useMemo(() => {
    if (displayedStep === null || displayedStepState === null) return null;
    if (displayedStepState.attempts.length === 0) return null;
    const latest =
      displayedStepState.attempts[displayedStepState.attempts.length - 1];
    return projectStepFeedback(displayedStep, latest.evaluation);
  }, [displayedStep, displayedStepState]);

  // ---- Actions ----

  const setSource = useCallback(
    (next: string) => {
      // In review mode, the editor is read-only; ignore writes.
      // The page also passes readOnly to Monaco, but we defend here in
      // case some future component wires setSource without checking mode.
      if (mode === "review") return;
      setActiveSource(next);
    },
    [mode],
  );

  const execute = useCallback(async () => {
    if (!canExecute) return;
    if (lesson === null || activeStep === null || session === null) return;
    if (activeStepState === null || activeStepState.status !== "active") return;

    setIsExecuting(true);
    try {
      const nextResult = await input.runner.execute({
        languageId: lesson.languageId,
        source: activeSource,
      });
      setActiveResult(nextResult);
      setActiveTimeline(nextResult.timeline);

      const outcome = toExecutionOutcome(nextResult);
      if (outcome !== null) {
        dispatch({
          type: "recordAttempt",
          lesson,
          source: activeSource,
          outcome,
          registry: input.registry,
        });
      }
    } finally {
      setIsExecuting(false);
    }
  }, [
    canExecute,
    lesson,
    activeStep,
    activeStepState,
    session,
    activeSource,
    input.runner,
    input.registry,
  ]);

  const continueToStep = useCallback((stepId: string) => {
    dispatch({ type: "activate", stepId });
  }, []);

  const resetLesson = useCallback(() => {
    // Reset applies to the whole lesson. If we happen to be in review
    // mode, exit it first so the returned state is coherent.
    setReviewingStepId(null);
    if (lesson === null) return;
    dispatch({ type: "reset", lesson });
    const pending = pendingPrismExecutionResult();
    setActiveResult(pending);
    setActiveTimeline(pending.timeline);
  }, [lesson]);

  const jumpToEvidence = useCallback(
    (sequence: number) => {
      // linkEvidence needs the snapshots the evidence was produced against.
      // Use the currently displayed result's snapshots so this works in
      // both active and review mode without special-casing.
      const linked = linkEvidence(result.snapshots, { sequence });
      if (linked.kind !== "resolved") return;
      if (mode === "review") {
        setReviewTimeline((prev) => prev.select(linked.snapshotIndex));
      } else {
        setActiveTimeline((prev) => prev.select(linked.snapshotIndex));
      }
    },
    [mode, result.snapshots],
  );

  const navigateTimeline = useCallback(
    (action: "next" | "previous" | "first" | "last" | number) => {
      const apply = (prev: TimelineController) => {
        if (typeof action === "number") return prev.select(action);
        switch (action) {
          case "next": return prev.next();
          case "previous": return prev.previous();
          case "first": return prev.first();
          case "last": return prev.last();
        }
      };
      if (mode === "review") {
        setReviewTimeline(apply);
      } else {
        setActiveTimeline(apply);
      }
    },
    [mode],
  );

  const enterReviewMode = useCallback(
    (stepId: string) => {
      // Only completed steps with at least one recorded attempt are
      // reviewable. Silently no-op otherwise; the UI already prevents
      // this by making only completed chips clickable, but we defend
      // at the domain boundary too.
      if (session === null) return;
      const target = session.stepStates.find((s) => s.stepId === stepId);
      if (!target) return;
      if (target.status !== "completed") return;
      if (target.attempts.length === 0) return;
      setReviewingStepId(stepId);
    },
    [session],
  );

  const exitReviewMode = useCallback(() => {
    setReviewingStepId(null);
  }, []);

  const currentSnapshot: VisualStateSnapshot | null =
    timeline.currentSnapshot ?? result.snapshots[0] ?? null;

  return {
    lesson,
    lessonError,
    session,
    activeStep,
    activeStepState,
    displayedStep,
    displayedStepState,
    lessonComplete,
    canExecute,
    source,
    setSource,
    isExecuting,
    result,
    timeline,
    currentSnapshot,
    feedback,
    mode,
    isInteractive,
    reviewingStepId,
    enterReviewMode,
    exitReviewMode,
    execute,
    continueToStep,
    resetLesson,
    jumpToEvidence,
    navigateTimeline,
  };
}