import { useEffect, useState } from 'react';

interface CountdownTick {
  active: boolean;
  remaining: number;
}

function computeRemaining(targetTimestamp: number | null): number | null {
  if (targetTimestamp == null) return null;
  return Math.floor(targetTimestamp - Date.now() / 1000);
}

// Ticks the service-start countdown against this DEVICE's own clock, not the server's.
// target_timestamp is a plain unix epoch (see targetTimeToTimestamp), so comparing it to
// Date.now() here needs no timezone knowledge at all - it's correct on whatever machine is
// actually driving the display, regardless of what timezone or OS the backend runs under.
export function useServiceCountdownTicker(enabled: boolean, targetTimestamp: number | null): CountdownTick {
  const [remaining, setRemaining] = useState<number | null>(() =>
    enabled ? computeRemaining(targetTimestamp) : null
  );

  useEffect(() => {
    if (!enabled || targetTimestamp == null) {
      setRemaining(null);
      return;
    }

    setRemaining(computeRemaining(targetTimestamp));
    const interval = setInterval(() => {
      setRemaining(computeRemaining(targetTimestamp));
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, targetTimestamp]);

  return { active: remaining != null && remaining > 0, remaining: remaining ?? 0 };
}
