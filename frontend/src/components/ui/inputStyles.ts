import { cn } from './cn';

export function inputStyles(className?: string) {
  return cn(
    'h-11 w-full rounded-[10px] border border-line-2 bg-surface px-[14px] text-[15px] text-ink outline-none transition placeholder:text-ink-4 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-ring)]',
    className
  );
}
