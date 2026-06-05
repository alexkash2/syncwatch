import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconOnly?: boolean;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white shadow-[0_1px_2px_rgba(16,23,20,0.08)] hover:bg-accent-strong',
  secondary: 'bg-ink text-white hover:bg-[#1d2722]',
  outline:
    'border-line-2 bg-surface text-ink shadow-[0_1px_2px_rgba(16,23,20,0.05)] hover:border-ink-4 hover:bg-surface-2',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-3 hover:text-ink',
  danger: 'bg-danger-tint text-danger hover:bg-[#f8dcdd]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-[34px] rounded-[8px] px-3 text-[13px]',
  md: 'h-10 rounded-[10px] px-4 text-sm',
  lg: 'h-12 rounded-[14px] px-[22px] text-[15px]',
};

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: 'h-[34px] w-[34px] rounded-[8px] px-0',
  md: 'h-10 w-10 rounded-[10px] px-0',
  lg: 'h-12 w-12 rounded-[14px] px-0',
};

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  iconOnly = false,
  className,
}: ButtonStyleOptions = {}) {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap border border-transparent font-semibold leading-none -tracking-[0.01em] transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55',
    variantClasses[variant],
    iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
    fullWidth && 'w-full',
    className
  );
}
