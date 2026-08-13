import type { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  tabBar: ReactNode;
  children: ReactNode;
}

export function AppShell({ header, tabBar, children }: AppShellProps) {
  return (
    <div className="min-h-[100dvh] bg-canvas text-content flex flex-col">
      {header}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8">
        {children}
      </main>
      {tabBar}
    </div>
  );
}
