/**
 * Variable State Panel.
 *
 * Receives a VariableRenderModel from the visualiser.
 * Renders variable state with created/changed/unchanged indicators.
 * Does not parse Learning IR or C++.
 */

import type { VariableRenderModel } from "@prism/visualizer-variable-state";

interface Props {
  model: VariableRenderModel;
}

export function VariablePanel({ model }: Props) {
  if (model.variables.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic px-2">
        No variables in scope.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {model.variables.map((variable) => (
        <div
          key={variable.entityId}
          className={`rounded-lg border p-3 transition-colors ${
            variable.changeKind === "created"
              ? "border-green-400 bg-green-50"
              : variable.changeKind === "changed"
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-mono font-bold text-gray-900">
              {variable.displayName}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {variable.dataType}
            </span>
            {variable.changeKind === "created" && (
              <span className="text-xs text-green-700 font-semibold ml-auto">
                created
              </span>
            )}
            {variable.changeKind === "changed" && (
              <span className="text-xs text-blue-700 font-semibold ml-auto">
                changed
              </span>
            )}
          </div>

          <div className="font-mono text-lg text-center py-2">
            {variable.changeKind === "changed" &&
            variable.previousValue !== undefined ? (
              <span>
                <span className="text-gray-400 line-through">
                  {variable.previousValue}
                </span>
                <span className="mx-2 text-blue-500">→</span>
                <span className="text-blue-700 font-bold">
                  {variable.currentValue}
                </span>
              </span>
            ) : (
              <span
                className={
                  variable.changeKind === "created"
                    ? "text-green-700 font-bold"
                    : "text-gray-800"
                }
              >
                {variable.currentValue}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}