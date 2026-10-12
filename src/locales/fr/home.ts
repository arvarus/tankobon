import type en from '../en/home';
import type { Translation } from '../types';

const home: Translation<typeof en> = {
  title: 'Accueil',
  secondChance: {
    title: 'Une deuxième chance',
    description: 'Vos livres les moins bien notés (2 étoiles ou moins). Peut-être le moment de leur redonner une chance.',
    empty: 'Aucun livre mal noté pour l’instant.',
  },
  suggestions: {
    title: 'À lire',
    shuffle: 'Tirer d’autres livres',
    empty: 'Aucun livre non lu dans la bibliothèque.',
  },
  continueReading: 'Reprendre la lecture',
  continueReadingEmpty: 'Aucun livre en cours de lecture.',
  scrollPrevious: 'Défiler vers la gauche',
  scrollNext: 'Défiler vers la droite',
  continueReadingPage: 'Page {{page}} / {{total}}',
  recentlyAdded: 'Derniers ajouts',
  recentlyAddedEmpty: 'Aucun livre dans la bibliothèque pour le moment.',
  openBook: 'Ouvrir {{title}}',
  favorites: {
    title: 'Redécouvrez vos favoris',
    rating: '{{rating}} / 5',
    empty: 'Aucun livre noté pour l’instant.',
  },
};

export default home;
