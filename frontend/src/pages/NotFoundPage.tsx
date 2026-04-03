import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-container/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 text-center">
        <h1 className="text-[12rem] font-black leading-none tracking-tighter text-on-surface opacity-90 mb-2">
          404
        </h1>
        <h2 className="text-2xl font-bold tracking-tight text-on-surface-variant mb-4">
          Page not found
        </h2>
        <p className="text-on-surface-variant/60 max-w-md mx-auto mb-12">
          The page you are looking for does not exist.
        </p>
        <Link
          to="/"
          className="bg-gradient-to-br from-primary-container to-[#0053da] text-on-primary-container px-10 py-4 font-bold text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,98,255,0.4)] active:scale-95 transition-all inline-block"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
