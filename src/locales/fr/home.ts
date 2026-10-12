import type en from '../en/home';
import type { Translation } from '../types';

const home: Translation<typeof en> = {
  title: 'Accueil',
  favorites: {
    title: 'Redécouvrez vos favoris',
    description: 'Une sélection de vos livres les mieux notés.',
    rating: '{{rating}} / 5',
  },
};

export default home;
