import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';
import { Panel } from './Panel';

export type StateTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const iconToneClasses: Record<StateTone, string> = {
  neutral: 'bg-surface-3 text-ink-3',
  primary: 'bg-accent-tint text-accent-strong',
  success: 'bg-accent-tint text-accent-strong',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
};

interface StatePanelProps extends ComponentPropsWithoutRef<'div'> {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: ReactNode;
  tone?: StateTone;
  align?: 'center' | 'left';
}

export function StatePanel({
  eyebrow,
  title,
  description,
  icon,
  actions,
  tone = 'neutral',
  align = 'center',
  className,
  ...props
}: StatePanelProps) {
  const isCentered = align === 'center';

  return (
    <Panel
      variant="default"
      padding="lg"
      className={cn(isCentered ? 'text-center' : '', className)}
      {...props}
    >
      {icon && (
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-[14px]',
            iconToneClasses[tone],
            isCentered ? 'mx-auto' : ''
          )}
        >
          {icon}
        </div>
      )}

      <div className={cn(icon ? 'mt-4' : '', isCentered ? 'mx-auto max-w-md' : 'max-w-xl')}>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-accent-strong">
            {eyebrow}
          </p>
        )}
        <h3 className="mt-2 text-2xl font-bold -tracking-[0.02em] text-ink">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-ink-2">{description}</p>
      </div>

      {actions && (
        <div
          className={cn(
            'mt-5 flex flex-wrap gap-3',
            isCentered ? 'justify-center' : 'justify-start'
          )}
        >
          {actions}
        </div>
      )}
    </Panel>
  );
}
