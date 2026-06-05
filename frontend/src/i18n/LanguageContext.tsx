import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18N, interpolate, type Dict, type Lang } from './dict';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** The full string dictionary for the active language (access as `t.create_room`). */
  t: Dict;
  /** Interpolating lookup: `ti('st_waiting_chip', { ready, total })`. */
  ti: (key: keyof Dict, vars: Record<string, string | number>) => string;
}

const STORAGE_KEY = 'sw-lang';

function readInitialLang(): Lang {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'pl' || stored === 'en' ? stored : 'en';
}

// eslint-disable-next-line react-refresh/only-export-components
export const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: I18N.en,
  ti: (key) => I18N.en[key],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => {
    const dict = I18N[lang];
    return {
      lang,
      setLang,
      t: dict,
      ti: (key, vars) => interpolate(dict[key], vars),
    };
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
