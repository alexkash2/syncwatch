import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import {
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from './buttonStyles';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      fullWidth = false,
      leadingIcon,
      trailingIcon,
      className,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonStyles({ variant, size, fullWidth, className })}
        {...props}
      >
        {leadingIcon}
        {children}
        {trailingIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
