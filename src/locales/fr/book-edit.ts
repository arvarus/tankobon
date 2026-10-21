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
  errors: {
    emptyTitle: 'Le titre ne peut pas être vide.',
    releaseDate: 'Date attendue : AAAA, AAAA-MM ou AAAA-MM-JJ.',
    lastName: 'Le nom est obligatoire (un pseudonyme va dans le nom).',
  },
};

export default bookEdit;
