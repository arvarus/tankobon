import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronDown, Settings } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SETTINGS_GROUPS } from '@/lib/settings-nav';
import { cn } from '@/lib/utils';

import { activeLinkClass, linkClass, subLinkClass } from './sidebar-styles';

/**
 * "Settings" unfolds its sub-pages instead of opening one big screen. Clicking it while folded
 * unfolds the list and opens the first section; clicking it while unfolded only folds it back
 * (navigating there too would drag the user off the section they're already on).
 */
export function SettingsNav({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation(['nav', 'settings']);
  const onSettings = useRouterState({
    select: (state) => state.location.pathname.startsWith('/settings'),
  });
  // Starts unfolded when the app is already on a settings page (e.g. after a reload).
  const [open, setOpen] = useState(onSettings);
  // The rail has no room for the sub-pages; they come back when it's expanded again.
  const unfolded = open && !collapsed;

  return (
    <>
      <Link
        to="/settings"
        className={cn(linkClass(collapsed), onSettings && activeLinkClass)}
        onClick={(event) => {
          if (unfolded) event.preventDefault();
          setOpen(!unfolded);
        }}
        title={collapsed ? t('settings') : undefined}
      >
        <Settings className="size-4" />
        {!collapsed && (
          <>
            <span className="flex-1">{t('settings')}</span>
            <ChevronDown className={cn('size-4 transition-transform', !unfolded && '-rotate-90')} />
          </>
        )}
      </Link>
      {unfolded &&
        SETTINGS_GROUPS.map((group) => (
          <Fragment key={group.id}>
            <span className="px-3 pt-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
              {t(`settings:groups.${group.id}`)}
            </span>
            {group.sections.map(({ to, id, icon: Icon }) => (
              <Link key={to} to={to} className={subLinkClass} activeProps={{ className: activeLinkClass }}>
                <Icon className="size-3.5" />
                {t(`settings:sections.${id}`)}
              </Link>
            ))}
          </Fragment>
        ))}
    </>
  );
}
