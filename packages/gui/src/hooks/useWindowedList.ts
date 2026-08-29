import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dependency-free fixed-row-height windowing.
 *
 * The agent catalog now holds 30+ rows and keeps growing, so rendering every
 * row on each paint is wasteful. This hook renders only the rows inside the
 * scroll viewport (plus a small overscan buffer) and pads the list with a
 * sized viewport + translated slice so the scrollbar stays accurate. It
 * intentionally avoids a virtualization library to keep the bundle lean — a
 * rAF-throttled scroll listener plus one translated container is all a
 * fixed-height list needs.
 *
 * Rows MUST be a constant height (`itemHeight`) for the math to hold.
 */
export interface WindowedRange {
  /** Index of the first rendered row (inclusive). */
  start: number;
  /** Index past the last rendered row (exclusive). */
  end: number;
  /** Total scrollable height of the list (px). */
  totalHeight: number;
  /** TranslateY offset for the rendered slice (px). */
  offsetTop: number;
}

export function useWindowedList(count: number, itemHeight: number, overscan = 6) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);
  const [range, setRange] = useState<WindowedRange>(() => ({
    start: 0,
    end: Math.min(count, 24),
    totalHeight: count * itemHeight,
    offsetTop: 0,
  }));

  const recompute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const viewport = el.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(count, Math.ceil((scrollTop + viewport) / itemHeight) + overscan);
    setRange((prev) => {
      const totalHeight = count * itemHeight;
      const offsetTop = start * itemHeight;
      if (
        prev.start === start &&
        prev.end === end &&
        prev.totalHeight === totalHeight &&
        prev.offsetTop === offsetTop
      ) {
        return prev; // no-op — avoids a re-render on every scroll tick
      }
      return { start, end, totalHeight, offsetTop };
    });
  }, [count, itemHeight, overscan]);

  // Recompute when the row count changes (catalog load / filter) and on mount.
  useEffect(() => {
    recompute();
  }, [recompute]);

  // Scroll events fire fast; rAF-throttle so we do at most one layout read per
  // frame and never queue duplicate frames.
  const onScroll = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      recompute();
    });
  }, [recompute]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  return { containerRef, onScroll, range };
}
