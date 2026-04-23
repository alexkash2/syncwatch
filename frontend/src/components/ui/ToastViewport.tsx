import { Button } from './Button';
import { Panel } from './Panel';
import {
  BrandMarkIcon,
  CheckIcon,
  WarningCircleIcon,
  XIcon,
} from './icons';

export type ToastTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export interface ToastRecord {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastViewportProps {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}

const toastToneClasses: Record<ToastTone, string> = {
  neutral: 'border-outline-variant/16 bg-black/75 text-on-surface',
  primary: 'border-primary-container/24 bg-[#0b1225]/88 text-on-surface',
  success: 'border-emerald-400/24 bg-[#07150f]/88 text-on-surface',
  warning: 'border-amber-300/24 bg-[#1a1407]/88 text-on-surface',
  danger: 'border-error/24 bg-[#210a0e]/90 text-on-surface',
};

const iconToneClasses: Record<ToastTone, string> = {
  neutral: 'border-outline-variant/18 bg-black/28 text-on-surface-variant',
  primary: 'border-primary-container/24 bg-primary-container/10 text-primary',
  success: 'border-emerald-400/24 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-300/24 bg-amber-300/10 text-amber-100',
  danger: 'border-error/28 bg-error-container/35 text-error',
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[110] flex flex-col gap-3 sm:inset-x-auto sm:right-6 sm:top-6 sm:bottom-auto sm:w-[24rem]"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <Panel
          key={toast.id}
          variant="glass"
          padding="sm"
          role="status"
          className={`ui-toast-enter pointer-events-auto rounded-[1.6rem] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.34)] ${toastToneClasses[toast.tone]}`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border ${iconToneClasses[toast.tone]}`}
            >
              <ToastIcon tone={toast.tone} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight text-on-surface">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-xs leading-6 text-on-surface-variant">
                  {toast.description}
                </p>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(toast.id)}
              className="h-9 w-9 rounded-full p-0"
              aria-label="Dismiss notification"
            >
              <XIcon size={14} />
            </Button>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  switch (tone) {
    case 'success':
      return <CheckIcon size={18} />;
    case 'warning':
    case 'danger':
      return <WarningCircleIcon size={18} />;
    default:
      return <BrandMarkIcon size={18} />;
  }
}
