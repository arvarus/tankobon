import { useTranslation } from 'react-i18next';

import { useImageScan } from '@/hooks/use-image-scan';
import { imageScanPercent } from '@/lib/image-scan';

/** The bar at the bottom of the window while the pages of the books are being measured in the background. */
export function ImageScanBar() {
  const { t } = useTranslation('library');
  const progress = useImageScan();
  if (!progress.running) return null;
  const percent = imageScanPercent(progress);

  return (
    <div role="status" className="flex shrink-0 items-center gap-3 border-t bg-sidebar px-4 py-1.5 text-xs text-muted-foreground">
      <span className="truncate">{t('imageScan', { processed: progress.processed, total: progress.total })}</span>
      <div
        role="progressbar"
        aria-label={t('imageScanLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-48 shrink-0 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
