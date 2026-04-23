import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { usePreferences } from '../../hooks/usePreferences';
import { Button } from '../ui/Button';
import {
  ArrowUpRightIcon,
  BrandMarkIcon,
  SettingsSlidersIcon,
  XIcon,
} from '../ui/icons';

export function Header() {
  const navigate = useNavigate();
  const { user, logout, openAuthModal, isAuthenticated } = useAuth();
  const { openPreferences, preferences } = usePreferences();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const headerOffsetRef = useRef(0);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const maxHeaderOffsetRef = useRef(112);

  const applyHeaderOffset = useCallback((nextOffset: number) => {
    headerOffsetRef.current = nextOffset;

    if (!headerRef.current) {
      return;
    }

    headerRef.current.style.transform = `translateY(-${nextOffset}px)`;
  }, []);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    const updateHeaderBounds = () => {
      if (!headerRef.current) {
        return;
      }

      const nextHeight = headerRef.current.getBoundingClientRect().height;
      maxHeaderOffsetRef.current = Math.max(Math.round(nextHeight + 12), 88);
      applyHeaderOffset(Math.min(headerOffsetRef.current, maxHeaderOffsetRef.current));
    };

    updateHeaderBounds();
    window.addEventListener('resize', updateHeaderBounds);

    return () => {
      window.removeEventListener('resize', updateHeaderBounds);
    };
  }, [applyHeaderOffset]);

  useEffect(() => {
    if (preferences.reduceMotion) {
      lastScrollYRef.current = window.scrollY;
      applyHeaderOffset(0);
      return;
    }

    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= 8) {
        applyHeaderOffset(0);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (Math.abs(delta) < 2) {
        return;
      }

      if (delta > 0) {
        setUserMenuOpen(false);
      }

      const motion = delta > 0 ? delta * 0.22 : delta * 0.34;
      const nextOffset = Math.min(
        Math.max(headerOffsetRef.current + motion, 0),
        maxHeaderOffsetRef.current
      );
      applyHeaderOffset(nextOffset);

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [applyHeaderOffset, preferences.reduceMotion]);

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4 transition-transform duration-100 ease-out will-change-transform md:px-8 xl:px-10"
    >
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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isAuthenticated) {
                navigate('/create');
                return;
              }

              openAuthModal('Sign in to create rooms and join watch sessions.');
            }}
            trailingIcon={<ArrowUpRightIcon size={14} />}
            className="hidden sm:inline-flex"
          >
            Create room
          </Button>
        </div>

        <div className="relative flex shrink-0 items-center gap-2 md:gap-4" ref={userMenuRef}>
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((current) => !current)}
                className="flex items-center gap-3 rounded-full border border-outline-variant/15 bg-surface-container-lowest/70 px-3 py-2 text-left transition hover:border-primary-container/30"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-highest text-primary">
                  <BrandMarkIcon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-on-surface">{user.username}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                    Signed In
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => openAuthModal('Sign in to create rooms and join watch sessions.')}
            >
              Log in
            </Button>
          )}

          {user && userMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+0.6rem)] z-20 min-w-56 rounded-[1.4rem] border border-outline-variant/15 bg-black/38 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  openPreferences();
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-[1rem] px-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-lowest/70"
                role="menuitem"
              >
                <SettingsSlidersIcon size={15} />
                <span>Settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-[1rem] px-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-lowest/70"
                role="menuitem"
              >
                <XIcon size={15} />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
