import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

type PanelVariant = 'default' | 'muted' | 'glass' | 'outline' | 'dashed';

const panelVariantClasses: Record<PanelVariant, string> = {
  default:
    'border border-outline-variant/15 bg-surface-container-low/76 shadow-[0_18px_44px_rgba(0,0,0,0.22)]',
  muted: 'border border-outline-variant/12 bg-surface-container-lowest/78',
  glass:
    'border border-outline-variant/18 bg-black/28 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl',
  outline: 'border border-outline-variant/18 bg-surface-container-low/54',
  dashed: 'border border-dashed border-outline-variant/25 bg-surface-container-lowest/84',
};

interface PanelProps extends ComponentPropsWithoutRef<'div'> {
  variant?: PanelVariant;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6 md:p-8',
} as const;

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  {
    variant = 'default',
    padding = 'md',
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[1.8rem]',
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
