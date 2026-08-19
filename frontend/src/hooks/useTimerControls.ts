import { useRef } from 'react';
import { startTimer, pauseTimer, resetTimer, addTime, subtractTime, type TimerState } from '../lib/api';

export type PrimaryAction = 'start' | 'pause' | 'resume';

// Single source of truth for timer transport actions, shared by the hero
// TransportControls button and the page-level keyboard shortcuts, so both paths
// agree on how to resume a paused segment (calling startTimer() with NO arguments -
// passing name/duration would overwrite the paused remaining with the full
// duration on the backend, restarting the segment instead of resuming it).
export function useTimerControls(state: TimerState | null) {
  const pendingRef = useRef(false);

  const guard = async (fn: () => Promise<unknown>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      await fn();
    } catch (e) {
      console.error('Timer control action failed:', e);
    } finally {
      pendingRef.current = false;
    }
  };

  const start = (name: string, durationSec: number, unplanned?: boolean) =>
    guard(() => startTimer(name, durationSec, unplanned));
  const resume = () => guard(() => startTimer());
  const pause = () => guard(() => pauseTimer());
  const reset = () => guard(() => resetTimer());
  const addSeconds = (sec: number) => guard(() => addTime(sec));
  const subtractSeconds = (sec: number) => guard(() => subtractTime(sec));

  // For the keyboard Space-bar shortcut and any "just do the obvious thing" toggle:
  // running -> pause, paused -> resume (no args), idle/completed -> restart the
  // last-configured segment if we have one.
  const toggle = () => {
    if (!state) return;
    if (state.status === 'running') {
      pause();
    } else if (state.status === 'paused') {
      resume();
    } else if (state.name && state.duration) {
      start(state.name, state.duration);
    }
  };

  const primaryAction: PrimaryAction =
    state?.status === 'running' ? 'pause' : state?.status === 'paused' ? 'resume' : 'start';

  return { primaryAction, start, resume, pause, reset, addSeconds, subtractSeconds, toggle };
}
