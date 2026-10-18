import type en from '../en/users';
import type { Translation } from '../types';

const users: Translation<typeof en> = {
  menu: {
    label: 'Menu utilisateur, connecté en tant que {{nickname}}',
    switchTo: 'Passer à {{nickname}}',
    current: 'Utilisateur actuel',
    editProfile: 'Mon profil',
    add: 'Ajouter un utilisateur…',
    heading: 'Utilisateurs',
  },
  newUser: {
    title: 'Nouvel utilisateur',
    description:
      'Le nouvel utilisateur partage la bibliothèque, mais démarre avec ses propres notes, listes, historique et réglages.',
    nickname: 'Pseudo',
    create: 'Créer et changer d’utilisateur',
  },
  profile: {
    title: 'Mon profil',
    nickname: 'Pseudo',
    nicknameHint: 'Pas de mot de passe : toute personne qui utilise l’application peut passer d’un utilisateur à l’autre.',
    save: 'Enregistrer',
    saved: 'Enregistré.',
    picture: 'Photo de profil',
    chooseImage: 'Choisir une image…',
    removeImage: 'Retirer l’image',
    imageError: 'Cette image est inutilisable.',
    shared:
      'La bibliothèque, ses métadonnées et son organisation sont communes à tous les utilisateurs. Tes notes, tags, progression, listes de lecture, statistiques, accomplissements et réglages (lecture, affichage, langue, accueil…) ne sont qu’à toi.',
    history: {
      title: 'Historique de lecture',
      empty: 'Rien pour l’instant : le temps passé à lire un livre de la bibliothèque apparaîtra ici.',
      removedBook: 'Livre retiré de la bibliothèque',
      clear: 'Effacer l’historique',
      confirmTitle: 'Effacer l’historique de lecture ?',
      confirmMessage: 'La liste des livres lus et le temps de lecture des statistiques sont supprimés. Tes livres, ta progression, tes notes et tes livres terminés sont conservés.',
      confirmAction: 'Effacer',
    },
    sharedSettings:
      'Les réglages de la bibliothèque (dossiers, organisation, sources de métadonnées, mises à jour) sont communs à tous les utilisateurs.',
    deleteButton: 'Supprimer cet utilisateur…',
    deleteTitle: 'Supprimer {{nickname}} ?',
    deleteMessage: 'Ses notes, étiquettes, progression, listes de lecture, statistiques, succès et réglages seront supprimés définitivement. La bibliothèque et les autres utilisateurs ne sont pas touchés.',
    deleteAction: 'Supprimer',
    deleteOnlyUser: 'Le dernier utilisateur ne peut pas être supprimé.',
  },
};

export default users;
