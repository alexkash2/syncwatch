import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthModal } from './AuthModal';
import { AuthContext, type AuthModalMode } from '../../contexts/AuthContext';
import type { LoginRequest, User } from '../../types/auth';

vi.mock('../../api/auth', () => ({
  register: vi.fn(),
}));

const { register: mockRegister } = await import('../../api/auth');

interface ContextOverrides {
  authModalOpen?: boolean;
  authModalMode?: AuthModalMode;
  authModalMessage?: string | null;
  isAuthenticated?: boolean;
  user?: User | null;
  login?: (data: LoginRequest) => Promise<void>;
  closeAuthModal?: () => void;
  openAuthModal?: (message?: string, mode?: AuthModalMode) => void;
  logout?: () => void;
}

function renderModal(overrides: ContextOverrides = {}) {
  const closeAuthModal = overrides.closeAuthModal ?? vi.fn();
  const login = overrides.login ?? vi.fn(async () => {});
  const value = {
    user: overrides.user ?? null,
    isLoading: false,
    isAuthenticated: overrides.isAuthenticated ?? false,
    authModalOpen: overrides.authModalOpen ?? true,
    authModalMessage: overrides.authModalMessage ?? null,
    authModalMode: overrides.authModalMode ?? ('login' as AuthModalMode),
    login,
    logout: overrides.logout ?? vi.fn(),
    openAuthModal: overrides.openAuthModal ?? vi.fn(),
    closeAuthModal,
  };

  const utils = render(
    <AuthContext.Provider value={value}>
      <AuthModal />
    </AuthContext.Provider>
  );
  return { ...utils, closeAuthModal, login };
}

describe('AuthModal', () => {
  beforeEach(() => {
    vi.mocked(mockRegister).mockReset();
  });

  it('renders nothing when closed', () => {
    const { container } = renderModal({ authModalOpen: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on Log in tab when mode is login', () => {
    renderModal({ authModalMode: 'login' });
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/choose a username/i)).not.toBeInTheDocument();
  });

  it('opens on Register tab when mode is register', () => {
    renderModal({ authModalMode: 'register' });
    expect(screen.getByRole('heading', { name: /join syncwatch/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/choose a username/i)).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const closeAuthModal = vi.fn();
    renderModal({ closeAuthModal });
    await userEvent.keyboard('{Escape}');
    expect(closeAuthModal).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click but not on dialog body click', async () => {
    const closeAuthModal = vi.fn();
    renderModal({ closeAuthModal });
    const backdrop = screen.getByRole('dialog');
    await userEvent.click(backdrop);
    expect(closeAuthModal).toHaveBeenCalledTimes(1);

    closeAuthModal.mockClear();
    await userEvent.click(screen.getByRole('heading', { name: /welcome back/i }));
    expect(closeAuthModal).not.toHaveBeenCalled();
  });

  it('rejects password mismatch before calling register', async () => {
    renderModal({ authModalMode: 'register' });
    await userEvent.type(screen.getByPlaceholderText(/choose a username/i), 'validuser');
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'a@b.co');
    await userEvent.type(screen.getByPlaceholderText(/at least 8 characters/i), 'password1');
    await userEvent.type(screen.getByPlaceholderText(/repeat the password/i), 'different1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(mockRegister).not.toHaveBeenCalled();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('rejects invalid username pattern before calling register', async () => {
    renderModal({ authModalMode: 'register' });
    await userEvent.type(screen.getByPlaceholderText(/choose a username/i), 'bad*user');
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'a@b.co');
    await userEvent.type(screen.getByPlaceholderText(/at least 8 characters/i), 'password1');
    await userEvent.type(screen.getByPlaceholderText(/repeat the password/i), 'password1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(mockRegister).not.toHaveBeenCalled();
    expect(screen.getByText(/username:/i)).toBeInTheDocument();
  });

  it('switches to Log in tab after successful register and clears sensitive fields', async () => {
    vi.mocked(mockRegister).mockResolvedValueOnce({
      id: 'u1',
      username: 'validuser',
      email: 'a@b.co',
      is_active: true,
      created_at: new Date().toISOString(),
    } as unknown as User);

    renderModal({ authModalMode: 'register' });
    await userEvent.type(screen.getByPlaceholderText(/choose a username/i), 'validuser');
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'a@b.co');
    await userEvent.type(screen.getByPlaceholderText(/at least 8 characters/i), 'password1');
    await userEvent.type(screen.getByPlaceholderText(/repeat the password/i), 'password1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockRegister).toHaveBeenCalledWith({
      username: 'validuser',
      email: 'a@b.co',
      password: 'password1',
    });

    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toHaveValue('');
  });
});
