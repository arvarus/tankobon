/**
 * Navigation of the settings sections.
 * @module
 */
import { BookOpen, Database, FolderTree, Globe, Home, Library, Palette, type LucideIcon } from 'lucide-react';

/** A settings sub-page; its label is the `settings:sections.<id>` translation. */
export interface SettingsSection {
  to: string;
  id: 'reading' | 'appearance' | 'home' | 'library' | 'organization' | 'metadata' | 'data';
  icon: LucideIcon;
}

/** A group of settings sub-pages; its label is the `settings:groups.<id>` translation. */
export interface SettingsGroup {
  id: 'user' | 'library';
  sections: SettingsSection[];
}

/**
 * The settings sub-pages, in two groups, shared by the sidebar's collapsible "Settings" entry and
 * the `/settings` layout — one list so the two can't drift apart. The `user` group holds what is
 * personal to each user (their `user_settings`), the `library` group what every user shares. "About"
 * is not a setting: it has its own sidebar entry and page (`/about`).
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'user',
    sections: [
      { to: '/settings/home', id: 'home', icon: Home },
      { to: '/settings/appearance', id: 'appearance', icon: Palette },
      { to: '/settings/reading', id: 'reading', icon: BookOpen },
      { to: '/settings/library', id: 'library', icon: Library },
    ],
  },
  {
    id: 'library',
    sections: [
      { to: '/settings/organization', id: 'organization', icon: FolderTree },
      { to: '/settings/metadata', id: 'metadata', icon: Globe },
      { to: '/settings/data', id: 'data', icon: Database },
    ],
  },
];
