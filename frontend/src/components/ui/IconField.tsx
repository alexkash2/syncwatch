import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from './cn';

interface IconFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  label?: string;
  hint?: string;
  trailing?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Branded input with a leading icon (and optional trailing control).
 * Shared by the auth modal and the create/join dashboard so every field
 * matches the design's soft `--surface-2` filled style.
 */
export function IconField({
  icon,
  label,
  hint,
  trailing,
  inputRef,
  className,
  id: providedId,
  ...inputProps
}: IconFieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-[7px]">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold tracking-[0.01em] text-ink-3">
          {label}
        </label>
      )}
      <div className="group relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-[15px] inline-flex text-ink-4 transition group-focus-within:text-accent">
            {icon}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          aria-describedby={hintId}
          className={cn(
            'h-[50px] w-full rounded-[10px] border border-transparent bg-surface-2 px-[14px] text-[15px] text-ink outline-none transition',
            'placeholder:text-ink-4 hover:bg-surface-3 focus:border-accent focus:bg-surface focus:shadow-[0_0_0_3px_var(--accent-ring)]',
            Boolean(icon) && 'pl-[44px]',
            Boolean(trailing) && 'pr-[46px]',
            className
          )}
          {...inputProps}
        />
        {trailing && <div className="absolute right-2 inline-flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}
