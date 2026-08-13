import { TimerReadout } from '../TimerReadout';
import type { TimerState } from '../../lib/api';

interface TimerStageProps {
  state: TimerState | null;
}

// The "TV-style" black stage box. Always dark regardless of app theme, so its text
// color must be an explicit always-light token (text-stage-content), not one that
// flips with theme - that's what caused the segment name to render black-on-black.
export function TimerStage({ state }: TimerStageProps) {
  return (
    <div className="bg-stage text-stage-content rounded-xl p-6 sm:p-8 text-center shadow-card">
      <TimerReadout state={state} />
    </div>
  );
}
