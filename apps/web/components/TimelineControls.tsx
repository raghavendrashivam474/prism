/**
 * Timeline navigation controls.
 *
 * Displays step counter and navigation buttons.
 * Calls navigate callbacks from useWorkspace.
 */

interface Props {
  currentIndex: number;
  totalSteps: number;
  isAtFirst: boolean;
  isAtLast: boolean;
  onPrevious(): void;
  onNext(): void;
  onFirst(): void;
  onLast(): void;
  disabled?: boolean;
}

export function TimelineControls({
  currentIndex,
  totalSteps,
  isAtFirst,
  isAtLast,
  onPrevious,
  onNext,
  onFirst,
  onLast,
  disabled = false,
}: Props) {
  const stepDisplay =
    totalSteps > 0 ? `STEP ${currentIndex + 1} / ${totalSteps}` : "NO TRACE";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-gray-500 min-w-[100px]">
        {stepDisplay}
      </span>

      <div className="flex gap-1">
        <button
          onClick={onFirst}
          disabled={disabled || isAtFirst}
          title="First step"
          className="px-2 py-1 rounded text-sm font-mono disabled:opacity-30
                     hover:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          |◀
        </button>
        <button
          onClick={onPrevious}
          disabled={disabled || isAtFirst}
          title="Previous step"
          className="px-2 py-1 rounded text-sm font-mono disabled:opacity-30
                     hover:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          ◀
        </button>
        <button
          onClick={onNext}
          disabled={disabled || isAtLast}
          title="Next step"
          className="px-2 py-1 rounded text-sm font-mono disabled:opacity-30
                     hover:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          ▶
        </button>
        <button
          onClick={onLast}
          disabled={disabled || isAtLast}
          title="Last step"
          className="px-2 py-1 rounded text-sm font-mono disabled:opacity-30
                     hover:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          ▶|
        </button>
      </div>
    </div>
  );
}