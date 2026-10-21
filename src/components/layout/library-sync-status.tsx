import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Progress } from '@/components/ui/progress';
import { useScanProgress } from '@/hooks/use-scan-progress';
import { useSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';

/**
 * The state of the library synchronization at the bottom of the sidebar, on every page: the
 * progress of the run in course (resynchronization, folder scan or organization, wherever it was
 * started), else the date of the last resynchronization. The rail only shows a spinning icon.
 */
export function LibrarySyncStatus({ collapsed }: { collapsed: boolean }) {
  const { t, i18n } = useTranslation('nav');
  const { settings } = useSettings();
  const progress = useScanProgress();
  const running = progress !== null;
  const known = progress !== null && progress.phase === 'importing' && progress.total > 0;
  const text = running
    ? known
      ? t('syncProgress', { processed: progress.processed, total: progress.total })
      : t('syncRunning')
    : settings.lastResyncAt
      ? t('syncLast', { date: new Date(settings.lastResyncAt).toLocaleString(i18n.language) })
      : t('syncNever');

  if (collapsed) {
    return running ? (
      <div role="status" title={text} aria-label={text} className="flex justify-center text-muted-foreground">
        <RefreshCw className="size-4 animate-spin" />
      </div>
    ) : null;
  }
  return (
    <div role="status" className="flex flex-col gap-1 px-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <RefreshCw className={cn('size-3.5 shrink-0', running && 'animate-spin')} />
        <span className="min-w-0 break-words">{text}</span>
      </span>
      {known && <Progress value={progress.processed} max={progress.total} label={t('syncRunning')} />}
    </div>
  );
}
