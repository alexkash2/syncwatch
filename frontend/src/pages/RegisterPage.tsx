import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { register } from '../api/auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register({ username, email, password });
      navigate('/login');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0e0e0e] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary-container/5 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 w-full max-w-[480px]">
        <header className="mb-12 text-center">
          <h1 className="text-primary text-4xl font-black tracking-tighter mb-2 uppercase italic">
            SyncWatch
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
            Synchronized Video Playback
          </p>
        </header>

        <section className="bg-surface-container/60 backdrop-blur-2xl p-10 shadow-[0px_24px_48px_rgba(0,0,0,0.4)] border border-outline-variant/10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-on-surface mb-1">Create Account</h2>
            <p className="text-on-surface-variant text-sm">
              Join SyncWatch to watch together with friends
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-on-surface py-3 px-0 transition-colors placeholder:text-on-surface-variant/30"
                placeholder="Username"
                required
                minLength={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant block">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-on-surface py-3 px-0 transition-colors placeholder:text-on-surface-variant/30"
                placeholder="Email"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant block">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-on-surface py-3 px-0 transition-colors placeholder:text-on-surface-variant/30"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant block">
                  Confirm
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-on-surface py-3 px-0 transition-colors placeholder:text-on-surface-variant/30"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && <p className="text-error text-sm">{error}</p>}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-br from-primary-container to-[#0053da] text-on-primary-container py-4 font-bold text-xs uppercase tracking-[0.15em] hover:shadow-[0_0_20px_rgba(0,98,255,0.4)] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Creating...' : 'Create account'}
              </button>
            </div>
          </form>

          <footer className="mt-8 pt-8 border-t border-outline-variant/10 text-center">
            <p className="text-on-surface-variant text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-bold hover:text-white transition-colors">
                Log in
              </Link>
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}
