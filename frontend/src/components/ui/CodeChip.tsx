import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from './cn';
import { CheckIcon, CopyIcon } from './icons';

interface CodeChipProps {
  code: string;
  onCopy?: () => void;
  /** Called when the clipboard write fails (e.g. denied / insecure context). */
  onError?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

/** Copyable room-code chip — always visible, one-click copy. */
export function CodeChip({ code, onCopy, onError, size = 'md', className }: CodeChipProps) {
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);

  const copy = useCallback(async () => {
    // Only report success once the write actually resolves; on a denied or
    // insecure-context clipboard the success affordance must NOT fire.
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      onError?.();
      return;
    }
    setDone(true);
    onCopy?.();
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setDone(false), 1500);
  }, [code, onCopy, onError]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label="Copy room code"
      className={cn(
        'inline-flex items-center gap-[10px] rounded-[10px] border border-line-2 bg-surface py-[6px] pl-[14px] pr-2 transition hover:border-accent hover:bg-accent-tint',
        className
      )}
    >
      <span
        className={cn(
          'font-mono font-semibold text-ink',
          size === 'sm' ? 'text-[13px] tracking-[0.16em]' : 'text-[15px] tracking-[0.2em]'
        )}
      >
        {code}
      </span>
      <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[7px] bg-surface-3 text-ink-3">
        {done ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
      </span>
    </button>
  );
}
