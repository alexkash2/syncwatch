import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useContext } from 'react';
import { AuthContext, AuthProvider } from './AuthContext';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock('../api/client', () => ({
  AUTH_LOGOUT_EVENT: 'syncwatch:auth-logout',
  clearAuthStorage: vi.fn(),
  storeAuthTokens: vi.fn(),
}));

function Probe() {
  const ctx = useContext(AuthContext);
  return (
    <div>
      <span data-testid="modal-open">{String(ctx.authModalOpen)}</span>
      <span data-testid="modal-mode">{ctx.authModalMode}</span>
      <span data-testid="modal-message">{ctx.authModalMessage ?? ''}</span>
      <button onClick={() => ctx.openAuthModal()}>open-default</button>
      <button onClick={() => ctx.openAuthModal('register please', 'register')}>
        open-register
      </button>
      <button onClick={() => ctx.closeAuthModal()}>close</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('opens modal in login mode by default', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(screen.getByTestId('modal-open')).toHaveTextContent('false');
    expect(screen.getByTestId('modal-mode')).toHaveTextContent('login');

    await act(async () => {
      screen.getByText('open-default').click();
    });

    expect(screen.getByTestId('modal-open')).toHaveTextContent('true');
    expect(screen.getByTestId('modal-mode')).toHaveTextContent('login');
    expect(screen.getByTestId('modal-message')).toHaveTextContent('');
  });

  it('carries explicit mode and message into state', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('open-register').click();
    });

    expect(screen.getByTestId('modal-open')).toHaveTextContent('true');
    expect(screen.getByTestId('modal-mode')).toHaveTextContent('register');
    expect(screen.getByTestId('modal-message')).toHaveTextContent('register please');
  });

  it('closeAuthModal clears open state and message', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('open-register').click();
    });

    await act(async () => {
      screen.getByText('close').click();
    });

    expect(screen.getByTestId('modal-open')).toHaveTextContent('false');
    expect(screen.getByTestId('modal-message')).toHaveTextContent('');
  });
});
