import type { ReactNode } from 'react';
import { TopBar } from './TopBar';

/** Page shell for the guest landing, dashboard and 404 — top bar + main region. */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar />
      <main id="main">{children}</main>
    </div>
  );
}
