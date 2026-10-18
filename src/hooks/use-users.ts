/**
 * The users of the app and the active one, as React state shared by every view.
 * @module
 */
import { useSyncExternalStore } from 'react';

import { appData } from '@/lib/app-data';
import type { UserProfile, UsersState } from '@/shared/users';

const subscribe = (listener: () => void) => appData.subscribe('users', listener);

/** Every user and the active one's id; `null` until the first load. */
export function useUsers(): UsersState | null {
  return useSyncExternalStore(subscribe, appData.getUsers);
}

/** The user using the app; `null` until the first load. */
export function useActiveUser(): UserProfile | null {
  const state = useUsers();
  return state ? (state.users.find((user) => user.id === state.activeId) ?? null) : null;
}
