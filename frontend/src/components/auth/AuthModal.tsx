import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { register } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { XIcon } from '../ui/icons';
import { Panel } from '../ui/Panel';
import type { AuthModalMode as AuthMode } from '../../contexts/AuthContext';

export function AuthModal() {
  const {
    authModalOpen,
    authModalMessage,
    authModalMode,
    closeAuthModal,
    login,
    isAuthenticated,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>(authModalMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

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

  // Initial focus + focus trap + Escape — mirrors SettingsDialog pattern
  useEffect(() => {
    if (!authModalOpen) {
      return;
    }

    window.requestAnimationFrame(() => {
      firstFieldRef.current?.focus();
    });

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

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
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

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          'Invalid email or password'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
      setError('Username: 3-30 characters, only letters, digits, and _ . -');
      return;
    }

    setLoading(true);

    try {
      await register({ username, email, password });
      setMode('login');
      setNotice('Account created. Log in to continue.');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          'Registration failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  // Shared props applied to all inputs when there is a form-level error
  const errorInputProps = error
    ? { 'aria-invalid': true as const, 'aria-describedby': errorId }
    : {};

  return (
    <div
      ref={dialogRef}
      className="ui-overlay-enter fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={handleBackdropClick}
    >
      <div className="ui-dialog-enter w-full max-w-[34rem]">
        <Panel variant="glass" padding="lg" className="relative rounded-[2rem]">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest/70 text-on-surface-variant transition hover:text-on-surface"
            aria-label={mode === 'login' ? 'Close sign-in dialog' : 'Close registration dialog'}
          >
            <XIcon size={18} />
          </button>

          <div className="pr-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </p>
            <h2 id="auth-modal-title" className="mt-3 text-3xl font-black text-on-surface">
              {mode === 'login' ? 'Welcome back' : 'Join SyncWatch'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              {authModalMessage ??
                'Use an account to create rooms, join shared sessions and keep room access secure.'}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full border border-outline-variant/14 bg-surface-container-lowest/70 p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`min-h-10 rounded-full text-sm font-bold transition ${
                mode === 'login'
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`min-h-10 rounded-full text-sm font-bold transition ${
                mode === 'register'
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Register
            </button>
          </div>

          <form
            onSubmit={mode === 'login' ? handleLogin : handleRegister}
            className="mt-6 space-y-5"
          >
            {mode === 'register' && (
              <Field label="Username">
                <Input
                  ref={firstFieldRef}
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Choose a username"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={30}
                  {...errorInputProps}
                />
              </Field>
            )}

            <Field label="Email Address">
              <Input
                ref={mode === 'login' ? firstFieldRef : undefined}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                {...errorInputProps}
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'register' ? 8 : undefined}
                {...errorInputProps}
              />
            </Field>

            {mode === 'register' && (
              <Field label="Confirm Password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat the password"
                  autoComplete="new-password"
                  required
                  {...errorInputProps}
                />
              </Field>
            )}

            {notice && (
              <Panel variant="outline" padding="sm" className="rounded-[1.2rem] text-primary">
                <p className="text-sm">{notice}</p>
              </Panel>
            )}

            {/* Persistent live region — always in DOM so SR announces the moment text appears */}
            <div
              id={errorId}
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            >
              {error && (
                <Panel
                  variant="outline"
                  padding="sm"
                  className="rounded-[1.2rem] border-error/30 bg-error-container/30 text-error"
                >
                  <p className="text-sm">{error}</p>
                </Panel>
              )}
            </div>

            <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
              {loading
                ? mode === 'login'
                  ? 'Logging in...'
                  : 'Creating...'
                : mode === 'login'
                ? 'Log in'
                : 'Create account'}
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
