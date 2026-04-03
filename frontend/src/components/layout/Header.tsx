import { Link } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0px_24px_48px_rgba(0,0,0,0.4),0px_0px_12px_rgba(0,98,255,0.1)] flex justify-between items-center px-12 h-16">
      <Link to="/" className="text-xl font-black tracking-tighter text-primary">
        SyncWatch
      </Link>
      {user && (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 pr-6 border-r border-outline-variant/20">
            <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-sm font-bold text-primary">
              {user.username[0].toUpperCase()}
            </div>
            <span className="text-sm text-on-surface-variant">{user.username}</span>
          </div>
          <button
            onClick={logout}
            className="text-on-surface-variant hover:text-on-surface transition-colors text-sm cursor-pointer"
          >
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
