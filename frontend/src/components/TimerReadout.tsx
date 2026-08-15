import { formatRemaining } from '../lib/time';
import { useTimeWarnings } from '../hooks/useTimeWarnings';
import type { TimerState } from '../lib/api';

interface TimerReadoutProps {
  state: TimerState | null;
  large?: boolean;
}

export function TimerReadout({ state, large = false }: TimerReadoutProps) {
  const warnings = useTimeWarnings(state?.remaining ?? null);

  if (!state) {
    return <div>Loading...</div>;
  }

  // Size the countdown off the actual rendered string length (5-8 chars depending on
  // hours/overtime) so it fills the viewport on a phone without overflowing, while
  // capping at a large fixed size on big screens (TV/projector).
  const remainingText = formatRemaining(state.remaining);
  const textSizeClass = large ? 'font-bold' : 'text-5xl sm:text-7xl font-bold';
  const timerSize = large
    ? { fontSize: `clamp(2.5rem, min(${(170 / remainingText.length).toFixed(1)}vw, 38vh), 18.75rem)` }
    : {};
  const nameSize = large
    ? 'font-bold'
    : 'text-xl sm:text-2xl font-semibold';
  const nameStyle = large ? { fontSize: 'clamp(2rem, min(9vw, 10vh), 14rem)' } : {};
  const gapClass = large ? 'gap-4 sm:gap-8 lg:gap-12' : 'gap-2 sm:gap-4';

  // Color transitions based on time remaining
  const statusColor =
    state.remaining <= 0 ? 'text-red-500' : // Red only at or past 0:00
    state.remaining <= 60 && state.status === 'running' ? 'text-amber-500' : // Amber/Orange in final minute
    state.status === 'running' ? 'text-green-500' :
    state.status === 'paused' ? 'text-yellow-500' :
    state.status === 'completed' ? 'text-red-500' :
    'text-gray-500';

  const pulseClass = warnings.isFinalMinute ? 'animate-pulse' : '';
  const showUpNext = large && state.next_segment_name && state.remaining > 0 && state.remaining <= 60;
  const upNextSize = large ? '' : 'text-xs';
  const upNextStyle = large ? { fontSize: 'clamp(1.75rem, min(6vw, 8vh), 4.75rem)' } : {};

  // The engine flips status to "completed" the instant remaining hits 0 (and keeps counting
  // into overtime), so this is the exact "segment has elapsed" signal.
  const isTimeUp = state.status === 'completed';
  const timeUpSize = large ? '' : 'text-xl sm:text-3xl';
  const timeUpStyle = large ? { fontSize: 'clamp(2rem, min(7vw, 8vh), 7rem)' } : {};

  return (
    <div className={`flex flex-col items-center justify-center w-full max-w-full px-4 text-center ${gapClass} ${pulseClass}`}>
      <div className={`${nameSize} break-words max-w-full`} style={nameStyle}>{state.name}</div>
      <div
        className={`${textSizeClass} ${statusColor} font-mono leading-none whitespace-nowrap tabular-nums`}
        style={timerSize}
      >
        {remainingText}
      </div>
      {isTimeUp && (
        <div
          className={`${timeUpSize} text-danger font-bold uppercase tracking-wide animate-pulse mt-2`}
          style={timeUpStyle}
        >
          Time's Up
        </div>
      )}
      {showUpNext && (
        <div className={`${upNextSize} text-accent dark:text-white font-bold mt-4 break-words max-w-full`} style={upNextStyle}>
          Up Next: {state.next_segment_name}
        </div>
      )}
    </div>
  );
}
