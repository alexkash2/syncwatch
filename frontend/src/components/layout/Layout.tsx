import type { ReactNode } from 'react';
import { Header } from './Header';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="pt-24 pb-12 px-4 md:px-12 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
