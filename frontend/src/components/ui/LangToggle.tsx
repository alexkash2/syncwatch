import { useI18n } from '../../hooks/useI18n';
import type { Lang } from '../../i18n/dict';
import { cn } from './cn';

const LANGS: Lang[] = ['en', 'pl'];

/** EN / PL language switch — a first-class control wired to LanguageContext. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn('inline-flex rounded-full bg-surface-3 p-[3px]', className)}
    >
      {LANGS.map((value) => {
        const active = lang === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(value)}
            className={cn(
              'rounded-full px-[11px] py-[5px] text-[12px] font-bold transition',
              active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(16,23,20,0.05)]' : 'text-ink-3'
            )}
          >
            {value.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
