/**
 * Lesson workspace page - Milestone 2.13b.
 *
 * Route: /lesson/[id]
 *
 * Composes every Sprint 2 domain package into a full lesson experience.
 * The page itself is thin - all state lives in useLessonWorkspace, all
 * transitions delegate to @prism/lessons pure functions.
 */

"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import type * as MonacoType from "monaco-editor";
import { HttpExecutionClient } from "@/lib/execution/client";
import { HttpExecutionRunner } from "@/lib/execution/runner";
import { getEvaluatorRegistry } from "@/lib/lesson/evaluator-registry";
import { useLessonWorkspace } from "@/lib/lesson/use-lesson-workspace";
import { LessonStepPanel } from "@/components/LessonStepPanel";
import { LessonFeedbackPanel } from "@/components/LessonFeedbackPanel";
import { LessonProgressPanel } from "@/components/LessonProgressPanel";
import { TimelineControls } from "@/components/TimelineControls";
import { VariablePanel } from "@/components/VariablePanel";
import { FailurePanel } from "@/components/FailurePanel";
import {
  VariableStateVisualizer,
  LearningIrV01StepDescriber,
} from "@prism/visualizer-variable-state";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-50 text-gray-400 text-sm">
      Loading editor...
    </div>
  ),
});

const executionClient = new HttpExecutionClient();
const executionRunner = new HttpExecutionRunner(executionClient);
const visualizer = new VariableStateVisualizer();
const describer = new LearningIrV01StepDescriber();

export default function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const registry = getEvaluatorRegistry();

  const {
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
  } = useLessonWorkspace({
    lessonId: id,
    runner: executionRunner,
    registry,
  });

  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof MonacoType | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const activeLine = currentSnapshot?.event.sourceLocation.line ?? null;

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    if (activeLine == null) {
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        [],
      );
      return;
    }
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      [
        {
          range: new monaco.Range(activeLine, 1, activeLine, 1),
          options: {
            isWholeLine: true,
            className: "prism-active-line",
            linesDecorationsClassName: "prism-active-line-gutter",
          },
        },
      ],
    );
  }, [activeLine]);

  const variableModel = useMemo(() => {
    if (!currentSnapshot) return null;
    if (!visualizer.supports(currentSnapshot)) return null;
    return visualizer.buildRenderModel(currentSnapshot);
  }, [currentSnapshot]);

  const stepDescription = useMemo(() => {
    if (!currentSnapshot) return null;
    return describer.describe(currentSnapshot);
  }, [currentSnapshot]);

  const hasSnapshots = result.snapshots.length > 0;
  const isFailure = result.status === "failure";

  const nextAvailableStepId: string | null = useMemo(() => {
    if (!session) return null;
    const next = session.stepStates.find((s) => s.status === "available");
    return next?.stepId ?? null;
  }, [session]);

  if (lessonError) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-lg font-semibold text-red-800">
            Could not load lesson
          </h1>
          <p className="text-sm text-red-700">{lessonError}</p>
          <p className="text-xs text-gray-500 font-mono">Lesson id: {id}</p>
        </div>
      </div>
    );
  }

  if (lesson === null || session === null || activeStep === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400 animate-pulse">Loading lesson...</p>
      </div>
    );
  }

  const currentStepNumber =
    session.stepStates.findIndex((s) => s.stepId === activeStep.id) + 1;

  const stepIsCompletedButNotAdvanced =
    activeStepState !== null &&
    activeStepState.status === "completed" &&
    !lessonComplete;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0 gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="font-bold text-gray-900 tracking-tight">PRISM</h1>
          <span className="text-xs text-gray-400 font-mono">
            {lesson.title}
          </span>
        </div>

        <div className="flex-1 flex justify-center">
          <LessonProgressPanel lesson={lesson} session={session} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={resetLesson}
            className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={execute}
            disabled={!canExecute}
            title={
              stepIsCompletedButNotAdvanced
                ? "This step is already complete. Click Continue to next step."
                : lessonComplete
                  ? "The lesson is complete."
                  : undefined
            }
            className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExecuting ? "Running..." : "Run"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 flex flex-col border-r border-gray-200">
          <div className="px-3 py-1.5 bg-white border-b border-gray-100 shrink-0">
            <span className="text-xs font-mono text-gray-500">SOURCE</span>
          </div>
          <div className="flex-1 min-h-0">
            <MonacoEditor
              language="cpp"
              value={source}
              onChange={(val) => setSource(val ?? "")}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                renderLineHighlight: "none",
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 8,
                lineNumbersMinChars: 3,
              }}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;
              }}
            />
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="px-3 py-1.5 bg-white border-b border-gray-100 shrink-0">
            <span className="text-xs font-mono text-gray-500">LESSON</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <LessonStepPanel
              step={activeStep}
              stepNumber={currentStepNumber}
              totalSteps={session.stepStates.length}
            />

            {lessonComplete && (
              <div className="rounded-lg border border-green-300 bg-green-50 p-4">
                <p className="font-semibold text-green-800">Lesson complete</p>
                <p className="text-sm text-green-900 mt-1">
                  You have satisfied every step in this lesson.
                </p>
              </div>
            )}

            {isFailure && result.status === "failure" && (
              <FailurePanel
                failure={{
                  category: result.failure.category,
                  message: result.failure.message,
                  violations:
                    result.trace?.events
                      .filter(
                        (e) =>
                          e.type === "execution.failed" &&
                          e.payload.kind === "execution.failed",
                      )
                      .flatMap((e) =>
                        e.payload.kind === "execution.failed"
                          ? [...e.payload.violations]
                          : [],
                      ) ?? [],
                  diagnostics:
                    result.trace?.events
                      .filter(
                        (e) =>
                          e.type === "execution.failed" &&
                          e.payload.kind === "execution.failed",
                      )
                      .flatMap((e) =>
                        e.payload.kind === "execution.failed"
                          ? [...e.payload.diagnostics]
                          : [],
                      ) ?? [],
                }}
              />
            )}

            {feedback && (
              <LessonFeedbackPanel
                feedback={feedback}
                onJumpToEvidence={jumpToEvidence}
                onContinue={
                  nextAvailableStepId
                    ? () => continueToStep(nextAvailableStepId!)
                    : undefined
                }
                canContinue={
                  feedback.tone === "success" && nextAvailableStepId !== null
                }
              />
            )}

            {stepDescription && hasSnapshots && (
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-400 font-mono mb-1">
                  EXECUTION STEP {timeline.currentIndex + 1} /{" "}
                  {timeline.totalSteps}
                </p>
                <p className="font-semibold text-gray-900 text-sm">
                  {stepDescription.title}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {stepDescription.detail}
                </p>
              </div>
            )}

            {variableModel && variableModel.variables.length > 0 && (
              <div>
                <p className="text-xs font-mono text-gray-500 mb-2">
                  VARIABLES
                </p>
                <VariablePanel model={variableModel} />
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="flex items-center gap-6 px-4 py-2 bg-white border-t border-gray-200 shrink-0">
        <TimelineControls
          currentIndex={timeline.currentIndex}
          totalSteps={timeline.totalSteps}
          isAtFirst={timeline.isAtFirst}
          isAtLast={timeline.isAtLast}
          onPrevious={() => navigateTimeline("previous")}
          onNext={() => navigateTimeline("next")}
          onFirst={() => navigateTimeline("first")}
          onLast={() => navigateTimeline("last")}
          disabled={!hasSnapshots || isExecuting}
        />
        {stepDescription && hasSnapshots && (
          <p className="text-sm text-gray-600 truncate">
            {stepDescription.detail}
          </p>
        )}
      </footer>
    </div>
  );
}