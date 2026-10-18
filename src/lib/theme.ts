/**
 * Color scheme of the interface.
 * @module
 */
import type { ThemeSetting } from '@/shared/settings';

/** Whether the interface is dark for `setting`, given whether the OS prefers a dark scheme. */
export function isDarkTheme(setting: ThemeSetting, systemPrefersDark: boolean): boolean {
  return setting === 'system' ? systemPrefersDark : setting === 'dark';
}
