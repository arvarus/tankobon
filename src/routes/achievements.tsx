import { Navigate, createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AchievementIcon } from '@/components/achievement-icon';
import { useSettings } from '@/hooks/use-settings';
import { useAchievements, useAchievementStats } from '@/hooks/use-achievements';
import { achievementProgress, ACHIEVEMENT_RULES } from '@/lib/achievements';
import { ACHIEVEMENT_GROUPS, ACHIEVEMENT_IDS } from '@/shared/achievements';

export const Route = createFileRoute('/achievements')({
  component: AchievementsPage,
});

function AchievementsPage() {
  const { settings } = useSettings();
  const { t, i18n } = useTranslation('achievements');
  const earned = useAchievements();
  const stats = useAchievementStats();
  const unlockedAt = new Map(earned?.map((achievement) => [achievement.id, achievement.unlockedAt]));

  if (!settings.achievementsEnabled) return <Navigate to="/library" replace />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('intro')}</p>
        {earned && (
          <p className="mt-2 text-sm font-medium">{t('summary', { unlocked: earned.length, total: ACHIEVEMENT_IDS.length })}</p>
        )}
      </header>
      {ACHIEVEMENT_GROUPS.map((group) => (
        <section key={group} aria-labelledby={`group-${group}`}>
          <h2 id={`group-${group}`} className="mb-3 text-lg font-semibold">
            {t(`groups.${group}`)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ACHIEVEMENT_IDS.filter((id) => ACHIEVEMENT_RULES[id].group === group).map((id) => {
              const date = unlockedAt.get(id);
              const progress = !date && stats ? achievementProgress(id, stats) : null;
              return (
                <li key={id} className="flex items-center gap-3 rounded-lg border p-3">
                  <AchievementIcon id={id} unlocked={date !== undefined} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t(`items.${id}.name`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`items.${id}.description`)}</p>
                    {date ? (
                      <p className="mt-1 text-xs text-achievement">
                        {t('unlockedOn', { date: new Date(date).toLocaleDateString(i18n.language) })}
                      </p>
                    ) : progress ? (
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={progress.target}
                          aria-valuenow={progress.value}
                          aria-label={t(`items.${id}.name`)}
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                        >
                          <div className="h-full bg-achievement" style={{ width: `${(progress.value / progress.target) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {progress.value}/{progress.target}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">{t('locked')}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
