import type en from '../en/home';
import type { Translation } from '../types';

const home: Translation<typeof en> = {
  title: 'Accueil',
  recentlyAdded: 'Derniers ajouts',
  recentlyAddedEmpty: 'Aucun livre dans la bibliothèque pour le moment.',
  openBook: 'Ouvrir {{title}}',
};

export default home;
