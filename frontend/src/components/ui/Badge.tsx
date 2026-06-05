import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

type BadgeTone = 'neutral' | 'accent' | 'ink' | 'primary' | 'success' | 'warning' | 'danger';

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-ink-3',
  accent: 'bg-accent-tint text-accent-strong',
  ink: 'bg-ink text-white',
  // legacy tones, mapped onto the light palette
  primary: 'bg-accent-tint text-accent-strong',
  success: 'bg-accent-tint text-accent-strong',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
};

interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ tone = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] rounded-full px-[9px] py-1 text-[11px] font-semibold leading-none tracking-[0.02em]',
        badgeToneClasses[tone],
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
