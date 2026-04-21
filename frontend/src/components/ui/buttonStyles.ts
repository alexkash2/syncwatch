import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-primary-container/40 bg-gradient-to-r from-primary-container to-[#0053da] text-on-primary-container shadow-[0_14px_32px_rgba(0,98,255,0.28)] hover:brightness-110',
  secondary:
    'border border-outline-variant/18 bg-surface-container-lowest/75 text-on-surface hover:border-primary-container/35 hover:bg-surface-container-high/40',
  ghost:
    'border border-outline-variant/16 bg-black/18 text-on-surface-variant hover:border-primary-container/35 hover:text-on-surface',
  danger:
    'border border-error/30 bg-error-container/38 text-on-surface hover:bg-error-container/60',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-[11px] tracking-[0.18em]',
  md: 'px-4.5 py-3 text-[11px] tracking-[0.2em]',
  lg: 'px-5 py-4 text-xs tracking-[0.22em]',
};

export function buttonStyles({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-bold uppercase transition disabled:cursor-not-allowed disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    className
  );
}
