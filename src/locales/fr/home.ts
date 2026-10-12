import type en from '../en/home';
import type { Translation } from '../types';

const home: Translation<typeof en> = {
  title: 'Accueil',
  secondChance: {
    title: 'Une deuxième chance',
    description: 'Vos livres les moins bien notés (1 ou 2 étoiles). Modifiez la note si vous avez changé d’avis.',
  },
};

export default home;
