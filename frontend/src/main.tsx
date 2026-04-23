import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { UiProvider } from './contexts/UiContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiProvider>
      <PreferencesProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PreferencesProvider>
    </UiProvider>
  </StrictMode>,
);
