import { Link } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { BrandMarkIcon } from '../ui/icons';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-[92rem] items-center justify-between rounded-[1.6rem] border border-outline-variant/15 bg-black/38 px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-2xl md:px-6">
        <div className="flex min-w-0 items-center gap-3 md:gap-5">
          <Link
            to="/"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-primary-container/20 bg-primary-container/10 px-3 text-xs font-black uppercase tracking-[0.22em] text-primary shadow-[0_0_30px_rgba(0,98,255,0.12)] transition hover:border-primary-container/40 hover:text-white min-[390px]:gap-3 min-[390px]:px-4 min-[390px]:text-sm min-[390px]:tracking-[0.28em]"
            aria-label="Go to SyncWatch home"
          >
            <BrandMarkIcon size={18} />
            <span className="hidden min-[390px]:inline">SyncWatch</span>
          </Link>

          <div className="hidden min-w-0 md:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
              Shared Local Playback
            </p>
            <p className="truncate text-sm text-on-surface">
              Rooms, file verification and synchronized watch sessions in one place.
            </p>
          </div>
        </div>

        {user && (
          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <div className="hidden items-center gap-3 rounded-full border border-outline-variant/15 bg-surface-container-lowest/70 px-3 py-2 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-highest text-primary">
                <BrandMarkIcon size={16} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-on-surface">{user.username}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                  Signed In
                </p>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
