import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SETTINGS_GROUPS } from '@/lib/settings-nav';

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
});

/**
 * Chrome shared by every settings sub-page (`src/routes/settings/*`). The sub-pages are picked
 * from the sidebar, which unfolds them under "Settings" (see `SETTINGS_SECTIONS`).
 */
function SettingsLayout() {
  const { t } = useTranslation('settings');
  const pathname = useLocation({ select: (location) => location.pathname });
  const section = SETTINGS_GROUPS.flatMap((group) => group.sections).find((candidate) => candidate.to === pathname);
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{section ? t('sectionTitle', { section: t(`sections.${section.id}`) }) : t('title')}</h1>
      <Outlet />
    </div>
  );
}
