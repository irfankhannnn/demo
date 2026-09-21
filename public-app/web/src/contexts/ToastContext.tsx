import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastKind = 'success' | 'info' | 'error';

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface ToastContextValue {
  toast: (title: string, opts?: { kind?: ToastKind; body?: string; durationMs?: number }) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, typeof Check> = { success: Check, info: Info, error: AlertTriangle };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastContextValue['toast']>(
    (title, opts) => {
      const id = ++idRef.current;
      const kind = opts?.kind ?? 'info';
      setToasts((t) => [...t.slice(-2), { id, kind, title, body: opts?.body }]);
      window.setTimeout(() => dismiss(id), opts?.durationMs ?? (kind === 'error' ? 6000 : 3600));
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, body) => toast(title, { kind: 'success', body }),
      error: (title, body) => toast(title, { kind: 'error', body }),
      info: (title, body) => toast(title, { kind: 'info', body }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-6 sm:items-end sm:px-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICONS[t.kind];
            return (
              <motion.div
                key={t.id}
                role="status"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-white/10 bg-ink px-4 py-3 text-paper shadow-pop"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    t.kind === 'success' && 'bg-tulsi text-ink',
                    t.kind === 'info' && 'bg-marigold text-ink',
                    t.kind === 'error' && 'bg-danger text-paper',
                  )}
                >
                  <Icon size={14} strokeWidth={2.5} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-xs leading-snug text-dust">{t.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="-mr-1 -mt-1 rounded-full p-1 text-dust hover:bg-white/10 hover:text-paper"
                >
                  <X size={16} aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
