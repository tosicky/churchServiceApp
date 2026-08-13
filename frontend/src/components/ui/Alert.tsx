import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info' | 'warning';

interface AlertProps {
  tone: Tone;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const toneClasses: Record<Tone, string> = {
  error: 'bg-danger-soft border-danger/30 text-danger-content',
  success: 'bg-success-soft border-success/30 text-success-content',
  warning: 'bg-warning-soft border-warning/30 text-warning-content',
  info: 'bg-accent-soft border-accent/30 text-content',
};

export function Alert({ tone, children, onDismiss, className = '' }: AlertProps) {
  return (
    <div className={`flex items-start justify-between gap-2 p-3 rounded-lg border text-sm ${toneClasses[tone]} ${className}`}>
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 font-semibold opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
