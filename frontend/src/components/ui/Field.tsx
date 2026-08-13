import type { ReactNode } from 'react';

interface FieldProps {
  label?: string;
  helper?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, helper, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5 text-content-secondary">{label}</label>}
      {children}
      {helper && <p className="text-xs text-content-muted mt-1">{helper}</p>}
    </div>
  );
}

// Shared class string for native <input>/<select>/<textarea> elements so every
// form control in the app looks and behaves identically without a wrapper component.
export const inputClass =
  'w-full px-3 py-2 min-h-[44px] border border-line rounded-lg bg-surface text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm disabled:opacity-50';
