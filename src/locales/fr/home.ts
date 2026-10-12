import type en from '../en/home';
import type { Translation } from '../types';

const home: Translation<typeof en> = {
  title: 'Accueil',
  suggestions: {
    title: 'À lire',
    shuffle: 'Tirer d’autres livres',
    empty: 'Aucun livre non lu dans la bibliothèque.',
  },
};

export default home;
