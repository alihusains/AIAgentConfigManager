import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Modal — the shared dialog (`.modal-overlay` > `.modal`).
 *
 * Rendered through a portal onto `document.body` so it is always positioned
 * against the viewport and stacks above everything, even if an ancestor uses
 * `transform` (e.g. the windowed lists). Escape closes it via a keydown
 * listener that is added only while open and removed on cleanup — no leaky
 * subscriptions. Backdrop click closes unless disabled. Not memoized: it is a
 * structural container whose `children` change every parent render.
 */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Optional footer row (action buttons). */
  footer?: ReactNode;
  /** Max width of the dialog in px. */
  maxWidth?: number;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 560,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  // Escape-to-close, subscribed only while open and always cleaned up.
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        className="modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer != null && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
