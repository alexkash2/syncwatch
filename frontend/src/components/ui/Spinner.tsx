import { cn } from './cn';

interface SpinnerProps {
  size?: number;
  /** 'stage' = white-on-dark (player stage); 'ink' = neutral-on-light. */
  tone?: 'stage' | 'ink';
  className?: string;
}

/** Circular loading spinner. */
export function Spinner({ size = 36, tone = 'stage', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'sw-spin inline-block rounded-full border-[3px] border-t-accent',
        tone === 'stage' ? 'border-white/15' : 'border-ink/15',
        className
      )}
      style={{ width: size, height: size }}
    />
  );
}
