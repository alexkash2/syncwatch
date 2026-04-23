import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { login as apiLogin, getMe } from '../api/auth';
import { AUTH_LOGOUT_EVENT, clearAuthStorage, storeAuthTokens } from '../api/client';
import type { LoginRequest, User } from '../types/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  authModalMessage: string | null;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  openAuthModal: (message?: string) => void;
  closeAuthModal: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  authModalOpen: false,
  authModalMessage: null,
  login: async () => {},
  logout: () => {},
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem('access_token')));
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    getMe()
      .then(setUser)
      .catch(() => {
        clearAuthStorage();
      })
      .finally(() => setIsLoading(false));
  }, []);

  // When the axios interceptor gives up on refreshing tokens, it dispatches
  // `syncwatch:auth-logout`. Without this listener the user state would stay
  // populated with a dead session, and ProtectedRoute would keep rendering
  // pages that can't reach the API.
  useEffect(() => {
    const handleLogout = () => setUser(null);
    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogout);
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const tokens = await apiLogin(data);
    storeAuthTokens(tokens);
    const me = await getMe();
    setUser(me);
    setAuthModalOpen(false);
    setAuthModalMessage(null);
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    setUser(null);
  }, []);

  const openAuthModal = useCallback((message?: string) => {
    setAuthModalMessage(message ?? null);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalMessage(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        authModalOpen,
        authModalMessage,
        login,
        logout,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
