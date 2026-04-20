import { forwardRef, type InputHTMLAttributes } from 'react';
import { inputStyles } from './inputStyles';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={inputStyles(className)} {...props} />;
  }
);

Input.displayName = 'Input';
