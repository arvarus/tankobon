import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ScanProgress } from '@/shared/library';

/** The folder scan's progress, with a close button once it is done. */
export function ScanProgressBar({ progress, onClose }: { progress: ScanProgress; onClose: () => void }) {
  // The walk reports no total yet, so the bar stays empty until the first file is opened.
  const scanning = progress.phase === 'scanning';
  const done = progress.phase === 'done';
  const { t } = useTranslation('library');

  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{scanning ? t('scanning') : `${progress.processed} / ${progress.total}`}</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground" title={progress.currentFile}>
          {progress.currentFile}
        </span>
        {done && (
          <Button variant="ghost" size="icon" aria-label={t('scanClose')} title={t('scanClose')} onClick={onClose}>
            <X />
          </Button>
        )}
      </div>
      <Progress value={progress.processed} max={progress.total} label={t('scanProgress')} />
    </div>
  );
}
