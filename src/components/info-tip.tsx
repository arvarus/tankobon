import { Info } from 'lucide-react';
import { useId } from 'react';

/**
 * A small "i" icon that explains something: the text shows in a bubble on hover and keyboard focus
 * (it is also the icon's accessible description). `label` names the icon for assistive technologies.
 */
export function InfoTip({ label, children }: { label: string; children: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Info className="size-4" aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-64 -translate-x-1/2 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md group-focus-within:block group-hover:block"
      >
        {children}
      </span>
    </span>
  );
}
