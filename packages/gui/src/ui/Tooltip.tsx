import {
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip — the shared hint primitive (audit A9).
 *
 * Replaces `title`-only tooltips, which are invisible on touch, arrive
 * after a ~1s delay, cannot be styled, and truncate long strings
 * (registry paths, drift explanations).
 *
 * Behavior:
 * - Shows on hover AND keyboard focus. Pointer clicks that focus the
 *   control do NOT open it (checked via :focus-visible), so clicking a
 *   button never flashes a tooltip.
 * - Touch: long-press (500ms) opens it; a quick tap still clicks the
 *   child. Scrolling cancels the long-press.
 * - Keyboard focus opens instantly (no delay); hover uses a 300ms delay.
 * - Position: above the trigger, flipped below when the viewport top
 *   would clip it. Clamped horizontally into the viewport.
 * - Esc closes the tooltip while visible.
 *
 * Accessibility: the portal tip is `role="tooltip"`, linked to the
 * trigger via aria-describedby while visible — screen readers announce
 * it on focus like a native title, minus the delay and touch blindness.
 *
 * Wrapper-less: clones the child and merges event handlers + ref, so no
 * extra DOM node disturbs flex/grid layouts. The child's native title
 * is suppressed while the Tooltip wraps it (no double tooltips).
 *
 * NOT a menu: content is non-interactive. It hides on blur/mouse-leave
 * — put actions in a Popover, not here.
 */

const SHOW_DELAY_POINTER_MS = 300;
const SHOW_DELAY_TOUCH_MS = 500;
const HIDE_DELAY_MS = 120;
const VIEWPORT_MARGIN_PX = 8;

export interface TooltipProps {
  /** Hint content. Keep it short — one line of help, not a paragraph. */
  content: ReactNode;
  children: ReactElement;
  /** Disable entirely (e.g. while its data is still loading). */
  disabled?: boolean;
}

/** Focus came from the keyboard (Tab), not a pointer tap/script focus. */
function focusIsKeyboard(el: Element | null): boolean {
  try {
    return el?.matches(':focus-visible') ?? false;
  } catch {
    return false;
  }
}

type Coords = { left: number; top: number; side: 'top' | 'bottom' };

export function Tooltip({ content, children, disabled = false }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const touchTimer = useRef<number | undefined>(undefined);
  const tipId = useId();

  const clearTimers = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(touchTimer.current);
  }, []);

  const showSoon = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => setOpen(true), SHOW_DELAY_POINTER_MS);
  }, []);

  const showNow = useCallback(() => {
    clearTimers();
    setOpen(true);
  }, [clearTimers]);

  const hideSoon = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setOpen(false), HIDE_DELAY_MS);
  }, []);

  /** Position the tip against the trigger; runs whenever it is open. */
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const tip = document.getElementById(tipId);
      if (!tip) return;
      const tipRect = tip.getBoundingClientRect();

      // Prefer above; flip below when the viewport top would clip it.
      const roomAbove = rect.top - tipRect.height - VIEWPORT_MARGIN_PX;
      const side: 'top' | 'bottom' = roomAbove >= 0 ? 'top' : 'bottom';
      const top = side === 'top' ? rect.top - tipRect.height - 6 : rect.bottom + 6;

      // Center on the trigger, clamped into the viewport.
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - tipRect.width / 2, VIEWPORT_MARGIN_PX),
        window.innerWidth - tipRect.width - VIEWPORT_MARGIN_PX
      );
      setCoords({ left, top, side });
    };

    // First pass: mount hidden (CSS), measure, then set coords so the
    // positioned class also picks the arrow side.
    place();
    // Re-place on resize/scroll while open (cheap; tooltips are small).
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, tipId]);

  // Esc closes the tooltip (not the app) while it is visible.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTimers();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, clearTimers]);

  // Unmount safety: never leak timers.
  useEffect(() => clearTimers, [clearTimers]);

  if (disabled || !isValidElement(children)) return children;

  const child = children as ReactElement<Record<string, unknown>>;
  const childProps = child.props;
  const merge = (key: string, handler: (e: never) => void) => {
    const existing = childProps[key] as ((e: never) => void) | undefined;
    return existing
      ? (e: never) => {
          existing(e);
          handler(e);
        }
      : handler;
  };

  return (
    <>
      {cloneElement(child, {
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node;
          const orig = childProps.ref as
            | ((node: HTMLElement | null) => void)
            | { current: HTMLElement | null }
            | undefined;
          if (typeof orig === 'function') orig(node);
          else if (orig && 'current' in orig) orig.current = node;
        },
        onMouseEnter: merge('onMouseEnter', showSoon),
        onMouseLeave: merge('onMouseLeave', hideSoon),
        onFocus: merge('onFocus', (e: React.FocusEvent<HTMLElement>) => {
          if (focusIsKeyboard(e.currentTarget)) showNow();
        }),
        onBlur: merge('onBlur', hideSoon),
        onTouchStart: merge('onTouchStart', () => {
          window.clearTimeout(touchTimer.current);
          touchTimer.current = window.setTimeout(showNow, SHOW_DELAY_TOUCH_MS);
        }),
        onTouchEnd: merge('onTouchEnd', () => {
          window.clearTimeout(touchTimer.current);
        }),
        onTouchMove: merge('onTouchMove', () => {
          window.clearTimeout(touchTimer.current);
        }),
        // A clicked trigger acts — opening a modal, toggling state — and
        // a stale floating tip must not linger beneath what appears next
        // (jsdom fires no mouseleave on click; real browsers rarely do
        // before the overlay lands). Close on activation.
        onClick: merge('onClick', () => {
          clearTimers();
          setOpen(false);
        }),
        // Keep the native title in sync with the content (string hints):
        // it remains a queryable attribute and an AT fallback. While our
        // styled tip is open the native one is cleared so the two never
        // render at once — and on touch the native one never fires at
        // all, which is the native gap this primitive exists to fix.
        title: open ? undefined : typeof content === 'string' ? content : childProps.title,
        'aria-describedby': open ? tipId : childProps['aria-describedby'],
      })}
      {open &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            className={`tooltip tooltip--${coords?.side ?? 'top'}`}
            style={
              coords
                ? { position: 'fixed', left: coords.left, top: coords.top }
                : { position: 'fixed', visibility: 'hidden', left: 0, top: 0 }
            }
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
