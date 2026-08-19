import { formatRemaining } from '../lib/time';

interface ServiceStartCountdownProps {
  remaining: number;
}

export function ServiceStartCountdown({ remaining }: ServiceStartCountdownProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-full px-4 text-center gap-4 sm:gap-8">
      <div
        className="font-bold text-accent dark:text-white break-words max-w-full"
        style={{ fontSize: 'clamp(1.5rem, min(6vw, 7vh), 8rem)' }}
      >
        Service Starts In
      </div>
      <div
        className="font-mono font-bold leading-none whitespace-nowrap tabular-nums text-content"
        style={{ fontSize: `clamp(2.5rem, min(${(170 / formatRemaining(remaining).length).toFixed(1)}vw, 38vh), 18.75rem)` }}
      >
        {formatRemaining(remaining)}
      </div>
      <div
        className="font-extrabold text-warning break-words max-w-full"
        style={{ fontSize: 'clamp(1.5rem, min(5vw, 6vh), 5rem)' }}
      >
        Be Ready And Be Blessed
      </div>
    </div>
  );
}
