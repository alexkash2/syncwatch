import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';
import { Panel } from './Panel';

type StateTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const iconToneClasses: Record<StateTone, string> = {
  neutral: 'border-outline-variant/18 bg-black/24 text-on-surface-variant',
  primary: 'border-primary-container/22 bg-primary-container/10 text-primary',
  success: 'border-emerald-400/22 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-300/22 bg-amber-300/10 text-amber-100',
  danger: 'border-error/24 bg-error-container/38 text-error',
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
      variant="outline"
      padding="md"
      className={cn(
        'rounded-[1.7rem] border-outline-variant/16 bg-surface-container-low/68',
        isCentered ? 'text-center' : '',
        className
      )}
      {...props}
    >
      {icon && (
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-[1.2rem] border shadow-[0_16px_40px_rgba(0,0,0,0.16)]',
            iconToneClasses[tone],
            isCentered ? 'mx-auto' : ''
          )}
        >
          {icon}
        </div>
      )}

      <div className={cn(icon ? 'mt-4' : '', isCentered ? 'mx-auto max-w-md' : 'max-w-xl')}>
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
        )}
        <h3 className="mt-2 text-2xl font-black tracking-tight text-on-surface">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-on-surface-variant">{description}</p>
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
