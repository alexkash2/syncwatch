import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { HomePage } from './HomePage';
import { AuthContext, type AuthModalMode } from '../contexts/AuthContext';
import { LanguageProvider } from '../i18n/LanguageContext';
import type { User } from '../types/auth';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../api/rooms', () => ({
  listRooms: vi.fn(async () => ({ rooms: [], total: 0 })),
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  deleteRoom: vi.fn(),
}));

interface AuthState {
  isAuthenticated: boolean;
  openAuthModal: (message?: string, mode?: AuthModalMode) => void;
  user?: User | null;
}

function renderPage(auth: AuthState) {
  const value = {
    user: auth.user ?? null,
    isLoading: false,
    isAuthenticated: auth.isAuthenticated,
    authModalOpen: false,
    authModalMessage: null,
    authModalMode: 'login' as AuthModalMode,
    login: vi.fn(async () => {}),
    logout: vi.fn(),
    openAuthModal: auth.openAuthModal,
    closeAuthModal: vi.fn(),
  };

  return render(
    <LanguageProvider>
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </AuthContext.Provider>
    </LanguageProvider>
  );
}

describe('HomePage (adaptive)', () => {
  it('guest sees the landing CTAs and Create opens the register modal', async () => {
    const openAuthModal = vi.fn();
    renderPage({ isAuthenticated: false, openAuthModal });

    await userEvent.click(screen.getByRole('button', { name: /create a room/i }));
    expect(openAuthModal).toHaveBeenCalledWith(undefined, 'register');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('guest Join with code opens the login modal', async () => {
    const openAuthModal = vi.fn();
    renderPage({ isAuthenticated: false, openAuthModal });

    await userEvent.click(screen.getByRole('button', { name: /join with code/i }));
    expect(openAuthModal).toHaveBeenCalledWith(undefined, 'login');
  });

  it('authenticated user lands on the dashboard workspace', async () => {
    renderPage({
      isAuthenticated: true,
      openAuthModal: vi.fn(),
      user: {
        id: 'u1',
        username: 'alice',
        email: 'a@b.co',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    });

    expect(await screen.findByRole('heading', { name: /start watching/i })).toBeInTheDocument();
  });
});
