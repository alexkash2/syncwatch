import type { ReactNode } from 'react';
import { Header } from './Header';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-on-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-surface focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(180,197,255,0.12),transparent_24%),linear-gradient(180deg,#0a0a0a_0%,#131313_42%,#171717_100%)]" />
        <div className="absolute left-[-8rem] top-20 h-72 w-72 rounded-full border border-primary-container/10 bg-primary-container/10 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-4rem] h-80 w-80 rounded-full border border-primary/10 bg-primary/8 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:34px_34px] opacity-25" />
      </div>

      <div className="relative z-10">
        <Header />
        <main id="main" className="mx-auto w-full max-w-[92rem] px-4 pb-14 pt-28 md:px-8 md:pt-32 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
