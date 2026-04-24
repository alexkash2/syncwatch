import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { StatePanel } from '../ui/StatePanel';
import { Button } from '../ui/Button';
import { ArrowUpRightIcon, BrandMarkIcon, XIcon } from '../ui/icons';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, openAuthModal } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      openAuthModal('Sign in to continue to this page.');
    }
  }, [isAuthenticated, isLoading, openAuthModal]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-on-surface-variant">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 text-on-surface">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.16),transparent_32%),linear-gradient(180deg,#090909_0%,#151515_100%)]" />
        <StatePanel
          eyebrow="Login Required"
          title="Sign in to continue"
          description="The room tools are private, so SyncWatch needs an account before opening this page."
          icon={
            <Link
              to="/"
              className="inline-flex items-center gap-3 rounded-[1.2rem] text-primary transition hover:text-on-surface"
              aria-label="Go to SyncWatch home"
            >
              <BrandMarkIcon size={26} />
              <span className="text-sm font-black uppercase tracking-[0.2em]">SyncWatch</span>
            </Link>
          }
          tone="primary"
          className="relative z-10 w-full max-w-xl [&>div:first-child]:w-auto [&>div:first-child]:px-4"
          actions={
            <>
              <Button
                variant="ghost"
                size="md"
                onClick={() => navigate('/')}
                leadingIcon={<XIcon size={15} />}
              >
                Back to home
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => openAuthModal('Sign in to continue to this page.')}
                trailingIcon={<ArrowUpRightIcon size={15} />}
              >
                Log in
              </Button>
            </>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
