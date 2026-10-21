import type en from '../en/book-edit';
import type { Translation } from '../types';

const bookEdit: Translation<typeof en> = {
  title: 'Modifier la fiche',
  volumePlaceholder: '3, 12.1, HS…',
  datePlaceholder: 'AAAA, AAAA-MM ou AAAA-MM-JJ',
  authors: 'Auteurs',
  noAuthors: 'Aucun auteur.',
  firstName: 'Prénom',
  lastName: 'Nom',
  lastNamePlaceholder: 'Nom ou pseudonyme',
  role: 'Rôle',
  removeAuthor: 'Retirer cet auteur',
  addAuthor: 'Ajouter un auteur',
  bulk: {
    title: 'Modifier la sélection',
    description_one:
      '{{count}} livre sélectionné. Cochez les champs à modifier : leur nouvelle valeur est appliquée à chaque livre sélectionné.',
    description_other:
      '{{count}} livres sélectionnés. Cochez les champs à modifier : leur nouvelle valeur est appliquée à chaque livre sélectionné.',
    field: 'Champ',
    current: 'Actuellement',
    after: 'Après',
    mixed: 'Valeurs différentes',
    newValue: 'Nouvelle valeur de {{field}}',
    hint: 'Une valeur vide efface le champ de chaque livre. Les auteurs remplacent toute la liste de chaque livre. Le titre ne se modifie pas ici.',
    apply_one: 'Appliquer à {{count}} livre',
    apply_other: 'Appliquer à {{count}} livres',
  },
  errors: {
    emptyTitle: 'Le titre ne peut pas être vide.',
    releaseDate: 'Date attendue : AAAA, AAAA-MM ou AAAA-MM-JJ.',
    lastName: 'Le nom est obligatoire (un pseudonyme va dans le nom).',
  },
};

export default bookEdit;
