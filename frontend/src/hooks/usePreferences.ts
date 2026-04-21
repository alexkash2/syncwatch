import { useContext } from 'react';
import { PreferencesContext } from '../contexts/PreferencesContext';

export function usePreferences() {
  return useContext(PreferencesContext);
}
