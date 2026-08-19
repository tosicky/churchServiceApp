import { useEffect, useState } from 'react';

export type ServiceCountdownRecurrence = 'once' | 'weekly';
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface ServiceCountdown {
  enabled: boolean;
  recurrence: ServiceCountdownRecurrence;
  target_time: string | null; // "HH:MM" 24-hour
  target_timestamp: number | null; // unix epoch seconds; authoritative for "once" mode
  weekday: Weekday | null; // authoritative for "weekly" mode
}

// Converts the "HH:MM" picker value into an absolute unix-epoch moment (today, THIS
// browser's local time) at save time. The backend then only ever compares epoch to epoch
// (time.time()), so no server-side timezone matters - the browser you set the time from
// is the one whose clock defines "today at HH:MM".
export function targetTimeToTimestamp(targetTime: string | null): number | null {
  if (!targetTime) return null;
  const [hourStr, minuteStr] = targetTime.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  return target.getTime() / 1000;
}

export function useServiceCountdown() {
  const [countdown, setCountdown] = useState<ServiceCountdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCountdown();
  }, []);

  const fetchCountdown = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/service-countdown');
      if (!response.ok) throw new Error('Failed to fetch service countdown');
      const data = await response.json();
      setCountdown(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateCountdown = async (next: ServiceCountdown) => {
    try {
      const response = await fetch('/api/service-countdown', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || 'Failed to update service countdown');
      }
      const updated = await response.json();
      setCountdown(updated);
      setError(null);
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      throw err;
    }
  };

  return { countdown, loading, error, updateCountdown, refetch: fetchCountdown };
}
