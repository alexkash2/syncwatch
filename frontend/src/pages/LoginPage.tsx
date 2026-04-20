import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../hooks/useAuth';
import { useUi } from '../hooks/useUi';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { pushToast } = useUi();
  const flashMessage = (location.state as { flash?: string } | null)?.flash;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    pushToast({
      tone: 'success',
      title: 'Account created',
      description: flashMessage,
      durationMs: 4200,
    });
    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [flashMessage, location.pathname, navigate, pushToast]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          'Invalid email or password'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Access Your Room"
      title="Pick up the watch party where you left it."
      description="Sign in to rejoin your rooms, sync with the host and keep the playback state consistent across everyone in the session."
      footerPrompt="Need an account?"
      footerLabel="Create one"
      footerHref="/register"
    >
      <div className="mb-8">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
          Welcome Back
        </p>
        <h2 className="text-3xl font-black tracking-tight text-on-surface">Log in</h2>
        <p className="mt-3 text-sm text-on-surface-variant">
          Use the same account you created your rooms with.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Email Address">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </Field>

        {error && (
          <Panel
            variant="outline"
            padding="sm"
            className="rounded-2xl border-error/30 bg-error-container/30 text-error"
            aria-live="polite"
          >
            <p className="text-sm">{error}</p>
          </Panel>
        )}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </Button>

        <Panel variant="muted" padding="sm" className="rounded-[1.6rem]">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Local-first playback
          </p>
          <p className="mt-2 text-xs leading-6 text-on-surface-variant">
            The session opens on this device only, and the room state syncs from there.
          </p>
        </Panel>
      </form>
    </AuthShell>
  );
}
