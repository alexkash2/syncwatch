import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthModal } from './AuthModal';
import { AuthContext, type AuthModalMode } from '../../contexts/AuthContext';
import { LanguageProvider } from '../../i18n/LanguageContext';
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
    <LanguageProvider>
      <AuthContext.Provider value={value}>
        <AuthModal />
      </AuthContext.Provider>
    </LanguageProvider>
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

  it('opens on the login view when mode is login', () => {
    renderModal({ authModalMode: 'login' });
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });

  it('opens on the register view when mode is register', () => {
    renderModal({ authModalMode: 'register' });
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const closeAuthModal = vi.fn();
    renderModal({ closeAuthModal });
    // The keydown listener lives on the dialog element, and the component's own
    // autofocus is async (requestAnimationFrame) — focus a field synchronously so
    // the key event reliably bubbles through the dialog regardless of timing.
    screen.getByLabelText('Email').focus();
    await userEvent.keyboard('{Escape}');
    expect(closeAuthModal).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click but not on dialog body click', async () => {
    const closeAuthModal = vi.fn();
    renderModal({ closeAuthModal });
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement as HTMLElement;

    await userEvent.click(backdrop);
    expect(closeAuthModal).toHaveBeenCalledTimes(1);

    closeAuthModal.mockClear();
    await userEvent.click(screen.getByRole('heading', { name: /welcome back/i }));
    expect(closeAuthModal).not.toHaveBeenCalled();
  });

  it('rejects an invalid username pattern before calling register', async () => {
    renderModal({ authModalMode: 'register' });
    await userEvent.type(screen.getByLabelText('Username'), 'bad*user');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'password1');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(mockRegister).not.toHaveBeenCalled();
    expect(screen.getByText(/username:/i)).toBeInTheDocument();
  });

  it('switches to the login view after a successful register and clears the password', async () => {
    vi.mocked(mockRegister).mockResolvedValueOnce({
      id: 'u1',
      username: 'validuser',
      email: 'a@b.co',
      is_active: true,
      created_at: new Date().toISOString(),
    } as unknown as User);

    renderModal({ authModalMode: 'register' });
    await userEvent.type(screen.getByLabelText('Username'), 'validuser');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'password1');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(mockRegister).toHaveBeenCalledWith({
      username: 'validuser',
      email: 'a@b.co',
      password: 'password1',
    });

    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
});
