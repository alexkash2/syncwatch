import { useContext } from 'react';
import { LanguageContext } from '../i18n/LanguageContext';

/** Access the active language, the string dictionary (`t`), and `setLang`/`ti`. */
export function useI18n() {
  return useContext(LanguageContext);
}
