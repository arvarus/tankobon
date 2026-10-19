import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

/** What a confirmation asks: a title, the consequence in `message`, and the label of the action. */
export interface ConfirmOptions {
  title: string;
  message: string;
  /** Label of the confirming button. */
  action: string;
  /** Label of an unchecked box shown above the buttons; only `confirmWithChoice()` reports whether it was checked. */
  checkbox?: string;
}

/** What `confirmWithChoice()` resolves with: the answer and the state of the optional box. */
export interface ConfirmChoice {
  confirmed: boolean;
  checked: boolean;
}

/**
 * In-app replacement for `window.confirm()`: `confirm(options)` resolves `true` when the user
 * confirms and `false` when they cancel, press Escape or click the backdrop; `confirmWithChoice()` also
 * reports the box of `ConfirmOptions.checkbox`. Render the returned `dialog` once in the component's tree.
 */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmWithChoice: (options: ConfirmOptions) => Promise<ConfirmChoice>;
  dialog: ReactNode;
} {
  const { t } = useTranslation('common');
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [checked, setChecked] = useState(false);
  const resolver = useRef<((choice: ConfirmChoice) => void) | null>(null);
  const settle = useCallback((confirmed: boolean) => {
    resolver.current?.({ confirmed, checked: confirmed && checked });
    resolver.current = null;
    setOptions(null);
  }, [checked]);

  const confirmWithChoice = useCallback((next: ConfirmOptions) => {
    // A confirmation still open is dismissed rather than left pending forever.
    resolver.current?.({ confirmed: false, checked: false });
    return new Promise<ConfirmChoice>((resolve) => {
      resolver.current = resolve;
      setChecked(false);
      setOptions(next);
    });
  }, []);

  const confirm = useCallback(
    async (next: ConfirmOptions) => (await confirmWithChoice(next)).confirmed,
    [confirmWithChoice],
  );

  const dialog = (
    <Dialog
      open={options !== null}
      onOpenChange={(open) => !open && settle(false)}
      title={options?.title ?? ''}
      description={options?.message}
      className="max-w-md"
    >
      {options?.checkbox && (
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          {options.checkbox}
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => settle(false)}>
          {t('cancel')}
        </Button>
        <Button variant="destructive" onClick={() => settle(true)}>
          {options?.action}
        </Button>
      </div>
    </Dialog>
  );

  return { confirm, confirmWithChoice, dialog };
}
