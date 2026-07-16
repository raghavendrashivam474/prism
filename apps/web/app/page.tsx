/**
 * PRISM Playground - main page (Milestone 2.13a refactor).
 *
 * The current snapshot is the single authority for all projections.
 * Monaco highlighting, variable panel, and step description all derive
 * from currentSnapshot - never from independent state.
 *
 * 2.13a change:
 *   The page now constructs an HttpExecutionRunner around the API client
 *   and passes it to useWorkspace. The runner owns ingestion + snapshot
 *   construction; the page and hook stay thin.
 */

"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useEffect } from "react";
import type * as MonacoType from "monaco-editor";
import { HttpExecutionClient } from "@/lib/execution/client";
import { HttpExecutionRunner } from "@/lib/execution/runner";
import { useWorkspace } from "@/lib/workspace/use-workspace";
import { VariableStateVisualizer } from "@prism/visualizer-variable-state";
import { LearningIrV01StepDescriber } from "@prism/visualizer-variable-state";
import { TimelineControls } from "@/components/TimelineControls";
import { VariablePanel } from "@/components/VariablePanel";
import { FailurePanel } from "@/components/FailurePanel";

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

export default function WorkspacePage() {
  const {
    status,
    source,
    setSource,
    timeline,
    failure,
    currentSnapshot,
    run,
    navigate,
  } = useWorkspace(executionRunner);

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

  const isExecuting = status === "executing";
  const hasTrace = status === "trace_ready" || status === "failed";

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-gray-900 tracking-tight">PRISM</h1>
          <span className="text-xs text-gray-400 font-mono">
            C++ * v0.1 profile
          </span>
        </div>
        <button
          onClick={run}
          disabled={isExecuting}
          className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isExecuting ? "Running..." : "Run"}
        </button>
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
            <span className="text-xs font-mono text-gray-500">
              VISUAL EXECUTION
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {status === "idle" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <p className="text-sm">Click Run to execute your C++ program.</p>
                <p className="text-xs mt-1 opacity-70">
                  Supported: int variables, arithmetic, sequential execution.
                </p>
              </div>
            )}

            {isExecuting && (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm animate-pulse">Executing...</p>
              </div>
            )}

            {status === "failed" && failure && (
              <FailurePanel failure={failure} />
            )}

            {status === "trace_ready" && currentSnapshot && (
              <>
                {stepDescription && (
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-400 font-mono mb-1">
                      STEP {timeline.currentIndex + 1} / {timeline.totalSteps}
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

                {(!variableModel || variableModel.variables.length === 0) && (
                  <p className="text-xs text-gray-400 italic">
                    No variables in scope at this step.
                  </p>
                )}
              </>
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
          onPrevious={() => navigate("previous")}
          onNext={() => navigate("next")}
          onFirst={() => navigate("first")}
          onLast={() => navigate("last")}
          disabled={!hasTrace || isExecuting}
        />
        {stepDescription && status === "trace_ready" && (
          <p className="text-sm text-gray-600 truncate">
            {stepDescription.detail}
          </p>
        )}
      </footer>
    </div>
  );
}
