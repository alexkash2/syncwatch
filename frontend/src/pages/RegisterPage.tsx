import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { register } from '../api/auth';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Panel } from '../components/ui/Panel';

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (password !== confirm) {
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
      navigate('/login', {
        state: { flash: 'Account created. Please log in.' },
      });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          'Registration failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create Your Space"
      title="Start a room and bring everyone onto the same timeline."
      description="Create an account to open rooms, verify local files and control the shared playback experience from a single, stable session."
      footerPrompt="Already registered?"
      footerLabel="Log in"
      footerHref="/login"
    >
      <div className="mb-8">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
          New Account
        </p>
        <h2 className="text-3xl font-black tracking-tight text-on-surface">Create account</h2>
        <p className="mt-3 text-sm text-on-surface-variant">
          You will use this account to create rooms and rejoin them later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Username">
          <Input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Choose a username"
            required
            minLength={3}
            maxLength={30}
          />
        </Field>

        <p className="-mt-3 text-[11px] leading-6 text-on-surface-variant/70">
          3-30 characters. Letters, digits, `_`, `.` and `-` are supported.
        </p>

        <Field label="Email Address">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>

        <p className="-mt-3 text-[11px] leading-6 text-on-surface-variant/70">
          Password must be at least 8 characters.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </Field>

          <Field label="Confirm">
            <Input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat the password"
              required
            />
          </Field>
        </div>

        {error && (
          <Panel
            variant="outline"
            padding="sm"
            className="rounded-2xl border-error/30 bg-error-container/30 text-error"
          >
            <p className="text-sm">{error}</p>
          </Panel>
        )}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
          {loading ? 'Creating...' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
