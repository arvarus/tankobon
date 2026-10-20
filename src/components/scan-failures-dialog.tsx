import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { ScanFailure } from '@/shared/library';

/**
 * Lists the files a resynchronization couldn't open, each with the reason. `total` is the exact
 * count of failures: the list itself is cut at `MAX_REPORTED_FAILURES`.
 */
export function ScanFailuresDialog({
  failures,
  total,
  onClose,
}: {
  failures: ScanFailure[];
  total: number;
  onClose: () => void;
}) {
  const { t } = useTranslation(['library', 'common']);

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('library:scanFailuresTitle')}
      description={t('library:scanFailuresIntro', { count: total })}
    >
      <ul className="flex min-h-0 flex-col gap-1.5 overflow-auto">
        {failures.map((failure) => (
          <li key={failure.path} className="rounded-md border p-2 text-sm">
            <span className="block font-mono text-xs break-all">{failure.path}</span>
            <span className="text-xs text-muted-foreground">{failure.reason}</span>
          </li>
        ))}
      </ul>
      {total > failures.length && (
        <p className="text-xs text-muted-foreground">
          {t('library:scanFailuresTruncated', { shown: failures.length, count: total })}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={onClose}>{t('common:close')}</Button>
      </div>
    </Dialog>
  );
}
