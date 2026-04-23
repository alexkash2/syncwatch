import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral: 'border-outline-variant/16 bg-black/18 text-on-surface-variant',
  primary: 'border-primary-container/28 bg-primary-container/10 text-primary',
  success: 'border-emerald-400/24 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-300/24 bg-amber-300/10 text-amber-100',
  danger: 'border-error/28 bg-error-container/35 text-error',
};

interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: BadgeTone;
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
        badgeToneClasses[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
