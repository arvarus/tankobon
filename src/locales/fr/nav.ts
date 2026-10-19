import type en from '../en/nav';
import type { Translation } from '../types';

const nav: Translation<typeof en> = {
  home: 'Accueil',
  library: 'Bibliothèque',
  readingLists: 'Listes de lecture',
  achievements: 'Accomplissements',
  reader: 'Lecteur',
  stats: 'Statistiques',
  settings: 'Paramètres',
  about: 'À propos',
  expandSidebar: 'Développer le panneau latéral',
  collapseSidebar: 'Réduire le panneau latéral',
};

export default nav;
