import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { HomePage } from './HomePage';
import { AuthContext, type AuthModalMode } from '../contexts/AuthContext';
import type { User } from '../types/auth';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../components/brand/BrandIllustration', () => ({
  BrandIllustration: () => <div data-testid="brand-illustration" />,
}));

vi.mock('../components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    <AuthContext.Provider value={value}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('HomePage hero actions', () => {
  it('Create a room navigates authenticated user to create-room section', async () => {
    navigateMock.mockClear();
    renderPage({ isAuthenticated: true, openAuthModal: vi.fn() });

    await userEvent.click(screen.getAllByRole('button', { name: /create a room/i })[0]);

    expect(navigateMock).toHaveBeenCalledWith('/create', {
      state: { focusSection: 'create-room' },
    });
  });

  it('Join with code navigates authenticated user to join-room section', async () => {
    navigateMock.mockClear();
    renderPage({ isAuthenticated: true, openAuthModal: vi.fn() });

    await userEvent.click(screen.getByRole('button', { name: /join with code/i }));

    expect(navigateMock).toHaveBeenCalledWith('/create', {
      state: { focusSection: 'join-room' },
    });
  });

  it('Create a room opens auth modal for guest with register-friendly prompt', async () => {
    navigateMock.mockClear();
    const openAuthModal = vi.fn();
    renderPage({ isAuthenticated: false, openAuthModal });

    await userEvent.click(screen.getAllByRole('button', { name: /create a room/i })[0]);

    expect(navigateMock).not.toHaveBeenCalled();
    expect(openAuthModal).toHaveBeenCalledWith('Sign in to create a room.');
  });

  it('Join with code opens auth modal for guest with join-specific prompt', async () => {
    navigateMock.mockClear();
    const openAuthModal = vi.fn();
    renderPage({ isAuthenticated: false, openAuthModal });

    await userEvent.click(screen.getByRole('button', { name: /join with code/i }));

    expect(navigateMock).not.toHaveBeenCalled();
    expect(openAuthModal).toHaveBeenCalledWith('Sign in to join a room with a code.');
  });
});
