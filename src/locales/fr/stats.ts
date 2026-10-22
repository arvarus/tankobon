import type en from '../en/stats';
import type { Translation } from '../types';

const stats: Translation<typeof en> = {
  title: 'Statistiques',
  intro: 'Votre bibliothèque et votre lecture. Les livres terminés et le temps de lecture sont enregistrés à partir de maintenant.',
  loadFailed: 'Impossible de charger les statistiques.',
  totals: {
    books: 'Livres',
    size: 'Taille de la bibliothèque',
    read: 'Livres lus',
    time: 'Temps de lecture',
  },
  period: {
    label: 'Regrouper par',
    month: 'Mois',
    year: 'Année',
  },
  charts: {
    booksRead: 'Livres lus',
    time: 'Temps de lecture',
    libraryGrowth: 'Livres dans la bibliothèque',
    libraryGrowthAria: 'Livres dans la bibliothèque à la fin de chaque {{period}}',
    libraryGrowthNote: 'Calculé d’après la date d’ajout de chaque livre ; les livres supprimés depuis ne sont pas comptés.',
    empty: 'Rien d’enregistré pour cette période.',
    booksReadAria: 'Livres lus par {{period}}',
    timeAria: 'Temps de lecture par {{period}}',
    periodMonth: 'mois',
    periodYear: 'année',
  },
  duration: {
    minutes: '{{count}} min',
    hours: '{{count}} h',
    hoursMinutes: '{{hours}} h {{minutes}} min',
  },
  barBooks_one: '{{count}} livre',
  barBooks_other: '{{count}} livres',
};

export default stats;
