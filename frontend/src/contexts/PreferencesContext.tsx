import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { SettingsDialog } from '../components/ui/SettingsDialog';
import {
  APP_PREFERENCES_STORAGE_KEY,
  defaultAppPreferences,
  type AppPreferences,
} from '../types/preferences';

interface PreferencesContextValue {
  preferences: AppPreferences;
  setPreference: <K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K]
  ) => void;
  togglePreference: <K extends keyof AppPreferences>(key: K) => void;
  resetPreferences: () => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

function loadStoredPreferences() {
  try {
    const rawValue = window.localStorage.getItem(APP_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return defaultAppPreferences;
    }

    const parsed = JSON.parse(rawValue) as Partial<AppPreferences>;
    return { ...defaultAppPreferences, ...parsed };
  } catch {
    return defaultAppPreferences;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: defaultAppPreferences,
  setPreference: () => {},
  togglePreference: () => {},
  resetPreferences: () => {},
  openPreferences: () => {},
  closePreferences: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(loadStoredPreferences);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(
      APP_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences)
    );
  }, [preferences]);

  useEffect(() => {
    document.documentElement.dataset.motion = preferences.reduceMotion
      ? 'reduced'
      : 'default';
  }, [preferences.reduceMotion]);

  const setPreference = useCallback(
    <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const togglePreference = useCallback(<K extends keyof AppPreferences>(key: K) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultAppPreferences);
  }, []);

  const openPreferences = useCallback(() => setDialogOpen(true), []);
  const closePreferences = useCallback(() => setDialogOpen(false), []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setPreference,
      togglePreference,
      resetPreferences,
      openPreferences,
      closePreferences,
    }),
    [closePreferences, openPreferences, preferences, resetPreferences, setPreference, togglePreference]
  );

  const dialog =
    typeof document === 'undefined'
      ? null
      : createPortal(
          <SettingsDialog
            open={dialogOpen}
            preferences={preferences}
            onTogglePreference={togglePreference}
            onReset={resetPreferences}
            onClose={closePreferences}
          />,
          document.body
        );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
      {dialog}
    </PreferencesContext.Provider>
  );
}
