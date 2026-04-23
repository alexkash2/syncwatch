import { cn } from './cn';

export function inputStyles(className?: string) {
  return cn(
    'w-full rounded-[1.35rem] border border-outline-variant/20 bg-surface-container-lowest/70 px-4 py-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/40 focus:border-primary-container',
    className
  );
}
