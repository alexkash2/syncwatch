import { useId, isValidElement, cloneElement, type ReactNode, type ReactElement } from 'react';

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}

export function Field({ label, children, hint, error }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  // Build the list of describedBy ids from Field's own hint/error
  const fieldDescribedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        // Merge Field's describedBy with any existing aria-describedby on the child
        ...(fieldDescribedBy
          ? {
              'aria-describedby': [
                (children as ReactElement<Record<string, unknown>>).props['aria-describedby'],
                fieldDescribedBy,
              ]
                .filter(Boolean)
                .join(' ') || undefined,
            }
          : {}),
        // Only set aria-invalid from Field if the child doesn't already have it set
        ...(error && !(children as ReactElement<Record<string, unknown>>).props['aria-invalid']
          ? { 'aria-invalid': true }
          : {}),
      })
    : children;

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant"
      >
        {label}
      </label>
      {child}
      {hint && (
        <p id={hintId} className="text-xs text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
