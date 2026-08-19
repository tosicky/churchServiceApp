export interface TimerState {
  name: string;
  duration: number;
  remaining: number;
  status: 'idle' | 'running' | 'paused' | 'completed';
  propresenter_connected: boolean;
  next_segment_name?: string | null;
  queue_position?: number | null;
  queue_length?: number | null;
  queue_names?: string[];
  service_countdown?: {
    enabled: boolean;
    recurrence: 'once' | 'weekly';
    target_time: string | null;
    target_timestamp: number | null;
    weekday: string | null;
    resolved_target_timestamp: number | null;
  } | null;
}

export async function getTimerState(): Promise<TimerState> {
  const response = await fetch('/api/timer/state');
  if (!response.ok) throw new Error('Failed to get timer state');
  return response.json();
}

export async function startTimer(name?: string, duration?: number, unplanned?: boolean): Promise<TimerState> {
  const response = await fetch('/api/timer/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, duration, unplanned }),
  });
  if (!response.ok) throw new Error('Failed to start timer');
  return response.json();
}

export async function pauseTimer(): Promise<TimerState> {
  const response = await fetch('/api/timer/pause', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to pause timer');
  return response.json();
}

export async function resetTimer(): Promise<TimerState> {
  const response = await fetch('/api/timer/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to reset timer');
  return response.json();
}

export async function addTime(seconds: number): Promise<TimerState> {
  const response = await fetch('/api/timer/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seconds }),
  });
  if (!response.ok) throw new Error('Failed to add time');
  return response.json();
}

export async function subtractTime(seconds: number): Promise<TimerState> {
  const response = await fetch('/api/timer/subtract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seconds }),
  });
  if (!response.ok) throw new Error('Failed to subtract time');
  return response.json();
}
