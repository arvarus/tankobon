/**
 * Scroll restoration of the continuous reader.
 * @module
 */
import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Scrolls the continuous reader to `resumePage` when a comic opens, and keeps that page
 * pinned to the top while pages load: every page starts as a fixed-height placeholder,
 * so pages above it (preloaded thanks to the observer's `rootMargin`) change height once
 * their image arrives and would otherwise push the resumed page out of view. Pinning stops
 * as soon as the user scrolls on their own.
 *
 * Runs as a layout effect so the first scroll happens before the page observers' first
 * (asynchronous) callbacks: page 0 is never reported as active, so the saved progress
 * isn't overwritten with the start of the book.
 *
 * Returns a ref that is true while the page is pinned, for whoever else adjusts the scroll position
 * when a page changes height (the pinning already does it, and both together would shift twice).
 */
export function useResumeScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  columnRef: RefObject<HTMLDivElement | null>,
  resumePage: number,
): RefObject<boolean> {
  const pinned = useRef(false);
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const column = columnRef.current;
    const target = column?.children[resumePage];
    if (!container || !column || !target || resumePage === 0) return;

    const pin = () => {
      container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top;
    };
    pin();
    pinned.current = true;

    const resizeObserver = new ResizeObserver(pin);
    resizeObserver.observe(column);

    const stop = () => {
      pinned.current = false;
      resizeObserver.disconnect();
      container.removeEventListener('wheel', stop);
      container.removeEventListener('pointerdown', stop);
      container.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
    container.addEventListener('wheel', stop, { passive: true });
    container.addEventListener('pointerdown', stop);
    container.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    return stop;
  }, [scrollRef, columnRef, resumePage]);
  return pinned;
}
