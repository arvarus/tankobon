/**
 * Scrolling back to the top when the page changes.
 * @module
 */
import { useRouterState } from '@tanstack/react-router';
import { useLayoutEffect, type RefObject } from 'react';

/**
 * Puts `ref`'s scroll position back to the top whenever the route's path changes. The root layout's
 * `<main>` stays mounted across routes, so without this a new page would open at the scroll offset of
 * the previous one. Search parameters don't count: changing them keeps the user where they are.
 */
export function useScrollToTopOnNavigation(ref: RefObject<HTMLElement | null>): void {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useLayoutEffect(() => {
    ref.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname, ref]);
}
