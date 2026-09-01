import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import X from 'lucide-react/dist/esm/icons/x.js';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import Info from 'lucide-react/dist/esm/icons/info.js';

export function ToastContainer() {
  const { toasts, removeToast } = useStore();

  return (
    <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
}

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}

/**
 * Auto-dismiss timing (audit A8):
 * - success/info: 5s — enough to register, short enough not to nag.
 * - error/warning: 8s — failures carry more information; give them time
 *   to be read.
 * The countdown pauses while the pointer is over the toast (or it holds
 * focus) and resumes with the remaining time when it leaves — a toast
 * under inspection never disappears mid-read.
 */
const TIMEOUT_MS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  error: 8000,
};

function Toast({ toast, onClose }: { toast: ToastData; onClose: (id: string) => void }) {
  const timerRef = useRef<number | undefined>(undefined);
  const remainingRef = useRef<number>(TIMEOUT_MS[toast.type]);
  const startedAtRef = useRef<number>(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const schedule = () => {
      window.clearTimeout(timerRef.current);
      startedAtRef.current = performance.now();
      pausedRef.current = false;
      timerRef.current = window.setTimeout(() => onClose(toast.id), remainingRef.current);
    };

    // Mount: start the countdown. Unmount: clear whatever is pending.
    schedule();
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer setup runs once per toast identity
  }, [toast.id, toast.type, onClose]);

  /** Pause: bank the un-elapsed portion so resume continues where it left off. */
  const pause = () => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    window.clearTimeout(timerRef.current);
    remainingRef.current = Math.max(
      0,
      remainingRef.current - (performance.now() - startedAtRef.current)
    );
  };

  /** Resume: restart the timer with the remaining time. */
  const resume = () => {
    if (!pausedRef.current) return;
    window.clearTimeout(timerRef.current);
    startedAtRef.current = performance.now();
    pausedRef.current = false;
    timerRef.current = window.setTimeout(() => onClose(toast.id), remainingRef.current);
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error: <AlertCircle className="w-5 h-5 text-error" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning" />,
    info: <Info className="w-5 h-5 text-accent" />,
  };

  const titles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  };

  return (
    <div
      className={`toast toast-${toast.type}`}
      role="alert"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <div className="toast-icon">
        {icons[toast.type]}
      </div>
      <div className="toast-content">
        <div className="toast-title">{toast.title || titles[toast.type]}</div>
        <div className="toast-message">{toast.message}</div>
      </div>
      <button className="toast-close" onClick={() => onClose(toast.id)} aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
