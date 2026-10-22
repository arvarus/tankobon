import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BarChart } from '@/components/stats/bar-chart';
import { Button } from '@/components/ui/button';
import { useLibrary } from '@/hooks/use-library';
import {
  buildBuckets,
  buildLibraryGrowth,
  formatDuration,
  libraryTotals,
  periodLabel,
  totalSeconds,
  type StatsPeriod,
} from '@/lib/reading-stats';
import { formatFileSize } from '@/lib/utils';
import type { ReadingStats } from '@/shared/stats';

export const Route = createFileRoute('/stats')({
  component: StatsPage,
});

function StatsPage() {
  const { t } = useTranslation('stats');
  const library = useLibrary();
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<StatsPeriod>('month');

  // The history is read when the page opens, and again when the library changes (a book finished
  // elsewhere); it is not part of the data store, since only this page shows it.
  useEffect(() => {
    let cancelled = false;
    window.tankobon.stats
      .get()
      .then((result) => {
        if (!cancelled) {
          setStats(result);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [library]);

  const totals = useMemo(() => libraryTotals(library ?? []), [library]);
  const buckets = useMemo(() => (stats ? buildBuckets(stats, period) : []), [stats, period]);
  const growth = useMemo(() => buildLibraryGrowth(library ?? [], period), [library, period]);
  const periodName = t(`charts.period${period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'Year'}`);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total label={t('totals.books')} value={String(totals.books)} />
        <Total label={t('totals.size')} value={formatFileSize(totals.bytes)} />
        <Total label={t('totals.read')} value={String(totals.read)} />
        <Total label={t('totals.time')} value={stats ? formatDuration(totalSeconds(stats)) : '…'} />
      </dl>

      {failed && <p className="text-sm text-destructive">{t('loadFailed')}</p>}

      <div className="flex items-center gap-2" role="group" aria-label={t('period.label')}>
        {(['week', 'month', 'year'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={period === value ? 'default' : 'outline'}
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
          >
            {t(`period.${value}`)}
          </Button>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t('charts.booksRead')}</h2>
        <BarChart
          ariaLabel={t('charts.booksReadAria', { period: periodName })}
          data={buckets.map((bucket) => ({
            key: bucket.key,
            label: periodLabel(bucket.key),
            value: bucket.booksRead,
            valueLabel: t('barBooks', { count: bucket.booksRead }),
          }))}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t('charts.libraryGrowth')}</h2>
        <BarChart
          ariaLabel={t('charts.libraryGrowthAria', { period: periodName })}
          data={growth.map((point) => ({
            key: point.key,
            label: periodLabel(point.key),
            value: point.books,
            valueLabel: t('barBooks', { count: point.books }),
          }))}
        />
        <p className="text-xs text-muted-foreground">{t('charts.libraryGrowthNote')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t('charts.time')}</h2>
        <BarChart
          ariaLabel={t('charts.timeAria', { period: periodName })}
          data={buckets.map((bucket) => ({
            key: bucket.key,
            label: periodLabel(bucket.key),
            value: bucket.seconds,
            valueLabel: formatDuration(bucket.seconds),
          }))}
        />
      </section>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
