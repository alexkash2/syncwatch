import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

type PanelVariant = 'default' | 'muted' | 'glass' | 'outline' | 'dashed';

const panelVariantClasses: Record<PanelVariant, string> = {
  default: 'border border-line bg-surface shadow-[0_1px_2px_rgba(16,23,20,0.05)]',
  muted: 'border border-line bg-surface-2',
  glass: 'border border-line bg-surface shadow-[0_18px_48px_rgba(16,23,20,0.12)]',
  outline: 'border border-line bg-surface',
  dashed: 'border border-dashed border-line-2 bg-surface-2',
};

interface PanelProps extends ComponentPropsWithoutRef<'div'> {
  variant?: PanelVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-[30px]',
} as const;

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { variant = 'default', padding = 'md', className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[18px]',
        panelVariantClasses[variant],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
