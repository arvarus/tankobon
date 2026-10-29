import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

/**
 * A modal dialog (Radix): focus trapped inside, closed by Escape, the close button or a click on
 * the backdrop. Controlled through `open`/`onOpenChange`. With `closeOnOutsideClick` false, a click
 * on the backdrop does nothing (Escape and the close button still close it): for dialogs where an
 * awkward click would lose work in progress. `onOpenAutoFocus` replaces the default focus on opening
 * (the first focusable element, i.e. the close button) when a field should receive it instead.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  closeOnOutsideClick = true,
  onOpenAutoFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  className?: string;
  closeOnOutsideClick?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border bg-background p-6 shadow-lg outline-none',
            className,
          )}
          onOpenAutoFocus={onOpenAutoFocus}
          onInteractOutside={closeOnOutsideClick ? undefined : (event) => event.preventDefault()}
          // Without a description Radix warns unless aria-describedby is explicitly unset.
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={t('close')}
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
