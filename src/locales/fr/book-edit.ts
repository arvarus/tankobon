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
  cover: 'Couverture',
  changeCover: 'Changer la couverture…',
  coverTitle: 'Changer la couverture',
  coverUpload: 'Envoyer une image',
  coverChooseFile: 'Choisir un fichier…',
  coverFromPage: 'Choisir une page du livre',
  coverPreviousPage: 'Page précédente',
  coverNextPage: 'Page suivante',
  coverPage: 'Page {{page}} / {{count}}',
  coverZoom: 'Zoom',
  coverHint: "Fais glisser l'image pour la déplacer ; le zoom la recadre. La couverture garde les proportions 2:3.",
  coverNoImage: 'Choisis une image ou une page pour commencer.',
  coverLoading: 'Chargement…',
  coverUnreadable: "Cette image n'a pas pu être lue.",
  coverSave: 'Utiliser comme couverture',
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
    saveFailed: 'Les livres n’ont pas pu être modifiés. Rien n’a été changé.',
  },
  errors: {
    emptyTitle: 'Le titre ne peut pas être vide.',
    releaseDate: 'Date attendue : AAAA, AAAA-MM ou AAAA-MM-JJ.',
    lastName: 'Le nom est obligatoire (un pseudonyme va dans le nom).',
  },
};

export default bookEdit;
