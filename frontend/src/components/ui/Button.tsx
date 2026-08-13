import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
type Size = 'sm' | 'md' | 'lg' | 'hero';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-accent-on',
  secondary: 'bg-surface-subtle hover:bg-line text-content border border-line',
  ghost: 'bg-transparent hover:bg-surface-subtle text-content-secondary',
  danger: 'bg-danger hover:opacity-90 text-danger-on',
  success: 'bg-success hover:opacity-90 text-success-on',
  warning: 'bg-warning hover:opacity-90 text-warning-on',
};

const sizeClasses: Record<Size, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-md',
  md: 'min-h-[44px] px-4 py-2 text-sm font-semibold rounded-lg',
  lg: 'min-h-[56px] px-4 py-3 text-base font-semibold rounded-lg',
  hero: 'min-h-[72px] px-6 py-4 text-xl font-bold rounded-xl w-full',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
