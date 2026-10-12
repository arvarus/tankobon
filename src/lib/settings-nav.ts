/**
 * Navigation of the settings sections.
 * @module
 */
import { BookOpen, Database, Globe, Home, Info, Library, Palette, type LucideIcon } from 'lucide-react';

/** A settings sub-page; its label is the `settings:sections.<id>` translation. */
export interface SettingsSection {
  to: string;
  id: 'reading' | 'appearance' | 'home' | 'library' | 'metadata' | 'data' | 'about';
  icon: LucideIcon;
}

/**
 * The settings sub-pages, shared by the sidebar's collapsible "Settings" entry and the
 * `/settings` layout — one list so the two can't drift apart.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { to: '/settings/reading', id: 'reading', icon: BookOpen },
  { to: '/settings/appearance', id: 'appearance', icon: Palette },
  { to: '/settings/home', id: 'home', icon: Home },
  { to: '/settings/library', id: 'library', icon: Library },
  { to: '/settings/metadata', id: 'metadata', icon: Globe },
  { to: '/settings/data', id: 'data', icon: Database },
  { to: '/settings/about', id: 'about', icon: Info },
];
