import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/Button';
import { LangToggle } from '../ui/LangToggle';
import { LogoIcon } from '../ui/icons';

/** Top bar shared by the guest landing and the authenticated dashboard. */
export function TopBar() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, openAuthModal } = useAuth();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header
      data-app-header
      className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-line bg-surface/80 px-4 backdrop-blur-md md:px-7"
    >
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-[10px]"
        aria-label="SyncWatch home"
      >
        <span className="inline-flex text-accent">
          <LogoIcon size={24} />
        </span>
        <span className="text-[17px] font-bold -tracking-[0.02em] text-ink">SyncWatch</span>
      </button>

      <div className="flex items-center gap-[14px]">
        <LangToggle />
        {isAuthenticated && user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-[9px] rounded-full border border-line-2 bg-surface py-[5px] pl-[14px] pr-[6px] transition hover:border-ink-4"
            >
              <span className="text-sm font-semibold text-ink">{user.username}</span>
              <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent-tint text-[13px] font-bold text-accent-strong">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[160px] rounded-[14px] border border-line bg-surface p-[6px] shadow-[0_18px_48px_rgba(16,23,20,0.12)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    navigate('/');
                  }}
                  className="w-full rounded-[8px] px-3 py-[9px] text-left text-sm font-medium text-ink transition hover:bg-surface-3"
                >
                  {t.log_out}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => openAuthModal(undefined, 'login')}>
            {t.log_in}
          </Button>
        )}
      </div>
    </header>
  );
}
