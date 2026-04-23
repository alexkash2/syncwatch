import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { Panel } from './Panel';
import { WarningCircleIcon, XIcon } from './icons';

type ConfirmTone = 'primary' | 'warning' | 'danger';

export interface ConfirmDialogConfig {
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmDialogProps extends ConfirmDialogConfig {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const iconToneClasses: Record<ConfirmTone, string> = {
  primary: 'border-primary-container/28 bg-primary-container/10 text-primary',
  warning: 'border-amber-300/26 bg-amber-300/10 text-amber-100',
  danger: 'border-error/30 bg-error-container/35 text-error',
};

export function ConfirmDialog({
  open,
  eyebrow,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    confirmButtonRef.current?.focus();

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="ui-overlay-enter fixed inset-0 z-[120] flex items-end justify-center bg-black/72 p-4 backdrop-blur-md sm:items-center sm:p-6">
      <Panel
        ref={dialogRef}
        variant="glass"
        padding="lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        tabIndex={-1}
        className="ui-dialog-enter relative w-full max-w-lg rounded-[2rem]"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full border border-outline-variant/16 bg-black/18 p-2 text-on-surface-variant transition hover:border-primary-container/35 hover:text-on-surface"
          aria-label="Close confirmation dialog"
        >
          <XIcon size={14} />
        </button>

        <div
          className={`flex h-14 w-14 items-center justify-center rounded-[1.2rem] border ${iconToneClasses[tone]}`}
        >
          <WarningCircleIcon size={24} />
        </div>

        {eyebrow && (
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2
          id="confirm-dialog-title"
          className="mt-2 text-3xl font-black tracking-tight text-on-surface"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-description"
          className="mt-4 text-sm leading-7 text-on-surface-variant"
        >
          {description}
        </p>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={tone === 'danger' ? 'danger' : tone === 'warning' ? 'secondary' : 'primary'}
            size="md"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
