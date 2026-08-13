import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export function Card({ children, padded = true, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`bg-surface border border-line rounded-xl shadow-card ${padded ? 'p-4 sm:p-6' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
