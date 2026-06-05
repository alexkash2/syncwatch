import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { StatePanel } from '../ui/StatePanel';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { LogoIcon } from '../ui/icons';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, openAuthModal } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      openAuthModal(t.sign_in_required, 'login');
    }
  }, [isAuthenticated, isLoading, openAuthModal, t.sign_in_required]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner size={36} tone="ink" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <StatePanel
          eyebrow="SyncWatch"
          title={t.sign_in_required}
          description={t.auth_login_sub}
          icon={<LogoIcon size={26} />}
          tone="primary"
          className="w-full max-w-md"
          actions={
            <>
              <Button variant="ghost" size="md" onClick={() => navigate('/')}>
                {t.back}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => openAuthModal(t.sign_in_required, 'login')}
              >
                {t.log_in}
              </Button>
            </>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
