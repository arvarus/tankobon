import { cn } from '@/lib/utils';

/** A sidebar entry; the icon-only rail (`collapsed`) centres it. */
export const linkClass = (collapsed: boolean) =>
  cn(
    'flex items-center gap-2 rounded-md py-1.5 text-sm text-muted-foreground',
    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    collapsed ? 'justify-center px-2' : 'px-2',
  );

/** Added to the entry of the page being shown. */
export const activeLinkClass = 'bg-sidebar-accent text-sidebar-accent-foreground';

/** A sub-entry under a foldable sidebar entry (settings sections, reading lists). */
export const subLinkClass = cn(linkClass(false), 'ml-4 gap-2 text-xs');
