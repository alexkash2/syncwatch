import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { UiProvider } from './contexts/UiContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </UiProvider>
  </StrictMode>,
);
