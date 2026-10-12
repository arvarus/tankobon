import type en from '../en/home';
import type { Translation } from '../types';

const home: Translation<typeof en> = {
  title: 'Accueil',
  suggestions: {
    title: 'À lire',
    shuffle: 'Tirer d’autres livres',
    empty: 'Aucun livre non lu dans la bibliothèque.',
  },
  continueReading: 'Reprendre la lecture',
  continueReadingPage: 'Page {{page}} / {{total}}',
  recentlyAdded: 'Derniers ajouts',
  recentlyAddedEmpty: 'Aucun livre dans la bibliothèque pour le moment.',
  openBook: 'Ouvrir {{title}}',
};

export default home;
