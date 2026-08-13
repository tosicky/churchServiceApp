import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  active?: boolean;
}

export function IconButton({ children, active = false, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active ? 'bg-accent-soft text-accent' : 'text-content-secondary hover:bg-surface-subtle hover:text-content'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
