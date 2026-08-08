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

  const textSizeClass = large ? 'font-bold' : 'text-4xl sm:text-6xl font-bold';
  const timerSize = large ? { fontSize: '260px' } : {};
  const nameSize = large ? 'text-9xl font-bold' : 'text-xl sm:text-2xl font-semibold';
  const gapClass = large ? 'gap-12' : 'gap-2 sm:gap-4';

  // Color transitions based on time remaining
  const statusColor =
    state.remaining <= 0 ? 'text-red-500' : // Red only at or past 0:00
    state.remaining <= 60 && state.status === 'running' ? 'text-amber-500' : // Amber/Orange in final minute
    state.status === 'running' ? 'text-green-500' :
    state.status === 'paused' ? 'text-yellow-500' :
    state.status === 'completed' ? 'text-red-500' :
    'text-gray-500';

  const pulseClass = warnings.isFinalMinute ? 'animate-pulse' : '';
  const showUpNext = large && (state as any).next_segment_name && state.remaining > 0 && state.remaining <= 60;
  const upNextSize = large ? 'text-4xl' : 'text-xs';

  return (
    <div className={`flex flex-col items-center justify-center ${gapClass} ${pulseClass}`}>
      <div className={nameSize}>{state.name}</div>
      <div className={`${textSizeClass} ${statusColor} font-mono leading-none`} style={timerSize}>
        {formatRemaining(state.remaining)}
      </div>
      {showUpNext && (
        <div className={`${upNextSize} text-gray-400 mt-4`}>
          Up Next: {(state as any).next_segment_name}
        </div>
      )}
    </div>
  );
}
