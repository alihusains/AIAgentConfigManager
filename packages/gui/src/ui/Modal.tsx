import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import X from 'lucide-react/dist/esm/icons/x.js';

/**
 * Modal — the shared dialog (`.modal-overlay` > `.modal`).
 *
 * Rendered through a portal onto `document.body` so it is always positioned
 * against the viewport and stacks above everything, even if an ancestor uses
 * `transform` (e.g. the windowed lists).
 *
 * Focus management (audit A1):
 * - Trap: Tab cycles inside the dialog — focus leaving forward at the last
 *   focusable wraps to the first, and Shift-Tab at the first wraps to the
 *   last. Implemented with a keydown capture on the document while open.
 * - Initial focus: the first focusable element (or the close button when
 *   nothing else exists) receives focus on open, so keyboard/SR users land
 *   inside the dialog, not on the page behind the overlay.
 * - Restore: focus returns to the element that had focus before the modal
 *   opened, so keyboard users never lose their place.
 *
 * Escape closes it via a keydown listener that is added only while open
 * and removed on cleanup — no leaky subscriptions. Backdrop click closes
 * unless disabled. Not memoized: it is a structural container whose
 * `children` change every parent render.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Latest-callback ref: the keydown subscription is keyed on `open` only,
  // so a new inline `onClose` per render never re-subscribes — and the
  // focus-restore cleanup below only runs when the dialog actually closes.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape-to-close + Tab wrap + focus in/out, active only while open.
  useEffect(() => {
    if (!open) return;

    // Remember where focus was so we can restore it on close (audit A1).
    restoreRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      // Only land focus when nothing inside the dialog already has it —
      // callers use autoFocus / refs to direct initial focus deliberately
      // (e.g. the first form field), and those commit before this effect.
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panel.contains(active)) {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        const first = focusables[0];
        if (first) {
          first.focus();
        } else {
          // Nothing focusable in body/footer — land on the close button.
          panel.querySelector<HTMLElement>('.modal-close')?.focus();
        }
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      // Focus trap: wrap Tab / Shift+Tab inside the dialog.
      const p = panelRef.current;
      if (!p) return;
      const els = Array.from(p.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (els.length === 0) return;
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || !p.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (active === lastEl || !p.contains(active))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Restore focus to the pre-open trigger (audit A1).
      restoreRef.current?.focus?.();
      restoreRef.current = null;
    };
  }, [open, closeOnEscape]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={panelRef}
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
