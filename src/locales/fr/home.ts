import type en from '../en/home';
import type { Translation } from '../types';

const home: Translation<typeof en> = {
  title: 'Accueil',
  secondChance: {
    title: 'Une deuxième chance',
    description: 'Vos livres les moins bien notés (2 étoiles ou moins). Peut-être le moment de leur redonner une chance.',
    empty: 'Aucun livre mal noté pour l’instant.',
  },
};

export default home;
