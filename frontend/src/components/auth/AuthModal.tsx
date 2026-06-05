import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { register } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Button } from '../ui/Button';
import { IconField } from '../ui/IconField';
import { EyeIcon, EyeOffIcon, LockIcon, LogoIcon, MailIcon, UserIcon, XIcon } from '../ui/icons';
import type { AuthModalMode as AuthMode } from '../../contexts/AuthContext';

export function AuthModal() {
  const { authModalOpen, authModalMessage, authModalMode, closeAuthModal, login, isAuthenticated } =
    useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile();

  const [mode, setMode] = useState<AuthMode>(authModalMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const isRegister = mode === 'register';

  useEffect(() => {
    if (authModalOpen) {
      setMode(authModalMode);
      setError('');
      setNotice('');
    }
  }, [authModalOpen, authModalMode]);

  useEffect(() => {
    if (isAuthenticated && authModalOpen) {
      closeAuthModal();
    }
  }, [authModalOpen, closeAuthModal, isAuthenticated]);

  useEffect(() => {
    if (!authModalOpen) {
      return;
    }

    window.requestAnimationFrame(() => firstFieldRef.current?.focus());

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAuthModal();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) {
    return null;
  }

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeAuthModal();
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setNotice('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (isRegister) {
      if (password.length < 8) {
        setError(t.err_password_short);
        return;
      }
      if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
        setError(t.err_username_rule);
        return;
      }
      setLoading(true);
      try {
        await register({ username, email, password });
        setMode('login');
        setNotice(t.notice_account_created);
        setUsername('');
        setPassword('');
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
            t.err_register_failed
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      await login({ email, password });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          t.err_invalid_credentials
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        'sw-fade fixed inset-0 z-[150] flex justify-center bg-[rgba(15,23,20,0.28)] backdrop-blur-[3px] ' +
        (isMobile ? 'items-end p-0' : 'items-center p-6')
      }
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className={
          'sw-scale-in w-full border border-line bg-surface shadow-[0_18px_48px_rgba(16,23,20,0.12)] ' +
          (isMobile
            ? 'max-w-none rounded-t-[20px] px-[22px] pb-[30px] pt-[26px]'
            : 'max-w-[420px] rounded-[18px] p-[30px]')
        }
      >
        <div className="mb-[22px] flex items-start justify-between">
          <div>
            <div className="mb-[10px] flex items-center gap-[9px] text-accent">
              <LogoIcon size={22} />
            </div>
            <h2 id="auth-modal-title" className="m-0 text-[22px] font-bold -tracking-[0.025em] text-ink">
              {isRegister ? t.auth_register_title : t.auth_login_title}
            </h2>
            <p className="mt-[6px] text-sm leading-[1.5] text-ink-3">
              {authModalMessage ?? (isRegister ? t.auth_register_sub : t.auth_login_sub)}
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label={t.close}
            className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-surface-3 text-ink-3 transition hover:text-ink"
          >
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {isRegister && (
            <IconField
              icon={<UserIcon size={18} />}
              label={t.username}
              inputRef={firstFieldRef}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="alice"
              autoComplete="username"
              minLength={3}
              maxLength={30}
              required
            />
          )}
          <IconField
            icon={<MailIcon size={18} />}
            label={t.email}
            inputRef={isRegister ? undefined : firstFieldRef}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <IconField
            icon={<LockIcon size={18} />}
            label={t.password}
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={isRegister ? 8 : undefined}
            aria-describedby={error ? errorId : undefined}
            trailing={
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((value) => !value)}
                aria-label={showPw ? t.hide_password : t.show_password}
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[8px] text-ink-4 transition hover:bg-surface-3 hover:text-ink-2"
              >
                {showPw ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
              </button>
            }
          />

          {notice && (
            <p className="rounded-[10px] bg-accent-tint px-[14px] py-[10px] text-sm text-accent-strong">
              {notice}
            </p>
          )}

          <div id={errorId} role="alert" aria-live="assertive" aria-atomic="true">
            {error && (
              <p className="rounded-[10px] bg-danger-tint px-[14px] py-[10px] text-sm text-danger">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading} className="mt-1">
            {t.continue}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => switchMode(isRegister ? 'login' : 'register')}
          className="mt-[18px] w-full text-center text-[13.5px] font-semibold text-accent-strong"
        >
          {isRegister ? t.auth_to_login : t.auth_to_register}
        </button>
      </div>
    </div>
  );
}
