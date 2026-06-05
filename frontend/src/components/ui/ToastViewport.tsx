import { CheckIcon, WarningCircleIcon } from './icons';
import { cn } from './cn';

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

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'warning' || tone === 'danger') {
    return <WarningCircleIcon size={15} />;
  }
  return <CheckIcon size={15} />;
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-7 z-[200] flex flex-col items-center gap-[10px]"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="sw-scale-in pointer-events-auto inline-flex max-w-[min(92vw,30rem)] items-center gap-[10px] rounded-full bg-ink px-4 py-[11px] text-left text-[13.5px] font-medium text-white shadow-[0_18px_48px_rgba(16,23,20,0.28)]"
        >
          <span
            className={cn(
              'inline-flex shrink-0',
              toast.tone === 'warning' || toast.tone === 'danger' ? 'text-warning' : 'text-accent'
            )}
          >
            <ToastIcon tone={toast.tone} />
          </span>
          <span className="min-w-0">
            <span className="font-semibold">{toast.title}</span>
            {toast.description && <span className="text-white/70"> — {toast.description}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
