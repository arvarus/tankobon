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
  chooser: {
    title: 'Qui lit ?',
    description: 'Choisissez votre profil pour ouvrir votre bibliothèque.',
    dontAskAgain: 'Ne plus proposer ce choix au démarrage',
    dontAskAgainHint: 'Vous pouvez le réactiver dans Paramètres › Bibliothèque.',
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
    sharedSettings:
      'Les réglages de la bibliothèque (dossiers, organisation, sources de métadonnées, mises à jour) sont communs à tous les utilisateurs.',
  },
};

export default users;
