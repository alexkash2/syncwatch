import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ConfirmDialog, type ConfirmDialogConfig } from '../components/ui/ConfirmDialog';
import {
  ToastViewport,
  type ToastRecord,
  type ToastTone,
} from '../components/ui/ToastViewport';

interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface UiContextValue {
  pushToast: (options: ToastOptions) => void;
  confirm: (options: ConfirmDialogConfig) => Promise<boolean>;
}

interface ConfirmRequest extends ConfirmDialogConfig {
  open: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const UiContext = createContext<UiContextValue>({
  pushToast: () => {},
  confirm: async () => false,
});

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const toastCounterRef = useRef(0);
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const dismissToast = useCallback((id: string) => {
    const timerId = toastTimersRef.current.get(id);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      toastTimersRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ title, description, tone = 'primary', durationMs = 3600 }: ToastOptions) => {
      const nextId = `toast-${toastCounterRef.current++}`;

      setToasts((current) => {
        const overflowToast = current.length >= 4 ? current[0] : null;
        if (overflowToast) {
          const timerId = toastTimersRef.current.get(overflowToast.id);
          if (timerId !== undefined) {
            window.clearTimeout(timerId);
            toastTimersRef.current.delete(overflowToast.id);
          }
        }

        const keptToasts = current.length >= 4 ? current.slice(1) : current;
        return [...keptToasts, { id: nextId, title, description, tone }];
      });

      const timerId = window.setTimeout(() => {
        dismissToast(nextId);
      }, durationMs);

      toastTimersRef.current.set(nextId, timerId);
    },
    [dismissToast]
  );

  const resolveConfirm = useCallback((value: boolean) => {
    confirmResolverRef.current?.(value);
    confirmResolverRef.current = null;
    setConfirmRequest(null);
  }, []);

  const confirm = useCallback(
    (options: ConfirmDialogConfig) =>
      new Promise<boolean>((resolve) => {
        if (confirmResolverRef.current) {
          confirmResolverRef.current(false);
        }

        confirmResolverRef.current = resolve;
        setConfirmRequest({ open: true, ...options });
      }),
    []
  );

  useEffect(() => {
    const toastTimers = toastTimersRef.current;

    return () => {
      toastTimers.forEach((timerId) => window.clearTimeout(timerId));
      toastTimers.clear();
      confirmResolverRef.current?.(false);
    };
  }, []);

  useEffect(() => {
    if (!confirmRequest) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        resolveConfirm(false);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [confirmRequest, resolveConfirm]);

  const value = useMemo<UiContextValue>(
    () => ({
      pushToast,
      confirm,
    }),
    [confirm, pushToast]
  );

  const overlays =
    typeof document === 'undefined'
      ? null
      : createPortal(
          <>
            <ToastViewport toasts={toasts} onDismiss={dismissToast} />
            <ConfirmDialog
              open={Boolean(confirmRequest?.open)}
              eyebrow={confirmRequest?.eyebrow}
              title={confirmRequest?.title ?? ''}
              description={confirmRequest?.description ?? ''}
              confirmLabel={confirmRequest?.confirmLabel}
              cancelLabel={confirmRequest?.cancelLabel}
              tone={confirmRequest?.tone}
              onConfirm={() => resolveConfirm(true)}
              onCancel={() => resolveConfirm(false)}
            />
          </>,
          document.body
        );

  return (
    <UiContext.Provider value={value}>
      {children}
      {overlays}
    </UiContext.Provider>
  );
}
