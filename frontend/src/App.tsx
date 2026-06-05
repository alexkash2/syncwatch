import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthModal } from './components/auth/AuthModal';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import type { AuthModalMode } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RoomPage } from './pages/RoomPage';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* Global skip link — first focusable element on every route (each page
            renders its own <main id="main">: Layout for standard pages, RoomPage
            for the room). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:border focus:border-line focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <Routes>
          <Route
            path="/login"
            element={<AuthPromptPage message="Sign in to continue." mode="login" />}
          />
          <Route
            path="/register"
            element={
              <AuthPromptPage
                message="Create an account or sign in to continue."
                mode="register"
              />
            }
          />
          <Route
            path="/"
            element={<HomePage />}
          />
          <Route
            path="/create"
            element={
              <ProtectedRoute>
                <CreateRoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/room/:roomId"
            element={
              <ProtectedRoute>
                <RoomPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <AuthModal />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function AuthPromptPage({ message, mode }: { message: string; mode: AuthModalMode }) {
  const { openAuthModal } = useAuth();

  useEffect(() => {
    openAuthModal(message, mode);
  }, [message, mode, openAuthModal]);

  return <HomePage />;
}
