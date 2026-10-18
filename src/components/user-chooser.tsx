import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UserAvatar } from '@/components/user-avatar';
import { useSettings } from '@/hooks/use-settings';
import { useUsers } from '@/hooks/use-users';
import { markUserChoiceDone, userChoiceDone } from '@/lib/user-choice';

/**
 * Full-window screen shown once at launch, when `AppSettings.askUserOnStartup` is on, to pick who is
 * reading. Choosing the user already active just closes it; "don't ask again" turns the setting off.
 */
export function UserChooser() {
  const { t } = useTranslation('users', { keyPrefix: 'chooser' });
  const { settings, update } = useSettings();
  const state = useUsers();
  const navigate = useNavigate();
  const [open, setOpen] = useState(!userChoiceDone() && settings.askUserOnStartup);
  const [dontAsk, setDontAsk] = useState(false);

  if (!open || !state) return null;

  const choose = async (id: string) => {
    if (dontAsk) update('askUserOnStartup', false);
    markUserChoiceDone();
    if (id !== state.activeId) {
      const result = await window.tankobon.users.switch(id).catch(() => null);
      if (result?.status !== 'ok') return;
      void navigate({ to: '/' });
    }
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-chooser-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-6"
    >
      <div className="text-center">
        <h1 id="user-chooser-title" className="text-2xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <ul className="flex max-w-3xl flex-wrap justify-center gap-4">
        {state.users.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              onClick={() => void choose(user.id)}
              className="flex w-32 flex-col items-center gap-2 rounded-lg p-3 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2"
            >
              <UserAvatar user={user} className="size-20" />
              <span className="w-full truncate text-sm font-medium">{user.nickname}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-center gap-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={dontAsk} onChange={(event) => setDontAsk(event.target.checked)} />
          {t('dontAskAgain')}
        </label>
        <p className="text-xs text-muted-foreground">{t('dontAskAgainHint')}</p>
      </div>
    </div>
  );
}
