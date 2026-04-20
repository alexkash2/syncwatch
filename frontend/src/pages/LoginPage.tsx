import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const flashMessage = (location.state as { flash?: string } | null)?.flash;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      navigate('/');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0e0e0e] relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full bg-primary-container/5 blur-[120px]" />
      </div>

      <main className="relative z-10 w-full max-w-[440px]">
        <div className="mb-12 text-center">
          <h1 className="font-black text-4xl tracking-tighter text-primary mb-2 uppercase italic">
            SyncWatch
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
            Synchronized Video Playback
          </p>
        </div>

        <div className="bg-surface-container-high/60 backdrop-blur-xl p-10 border border-outline-variant/20 shadow-[0px_24px_48px_rgba(0,0,0,0.4)]">
          <div className="mb-10">
            <h2 className="font-bold text-2xl tracking-tight text-on-surface mb-1">
              Welcome back
            </h2>
            <p className="text-sm text-on-surface-variant">
              Enter your credentials to continue.
            </p>
          </div>

          {flashMessage && (
            <div className="mb-6 p-3 bg-primary-container/20 border border-primary-container/40 text-primary text-sm">
              {flashMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/20 text-on-surface text-sm py-3 px-0 focus:outline-none focus:border-primary-container transition-colors placeholder:text-on-surface-variant/30"
                placeholder="Email"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/20 text-on-surface text-sm py-3 px-0 focus:outline-none focus:border-primary-container transition-colors placeholder:text-on-surface-variant/30"
                placeholder="Password"
                required
              />
            </div>

            {error && (
              <p className="text-error text-sm">{error}</p>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-br from-primary-container to-[#0053da] w-full py-4 text-on-primary-container font-bold text-xs uppercase tracking-[0.15em] hover:shadow-[0_0_20px_rgba(0,98,255,0.4)] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-on-surface-variant">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-bold hover:text-white transition-colors">
              Register
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
