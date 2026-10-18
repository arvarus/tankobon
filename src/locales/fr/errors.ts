import type en from '../en/errors';
import type { Translation } from '../types';

const errors: Translation<typeof en> = {
  archive: {
    unknownBook: 'Ce livre n’est pas dans la bibliothèque : choisissez à nouveau le fichier.',
    unsupportedFormat: 'Format non supporté : {{extension}}',
    noExtension: '(sans extension)',
    unknown: 'Archive inconnue : {{id}}',
    noImages: 'Aucune image trouvée dans {{path}}',
    noPages: 'Aucune page trouvée dans {{path}}',
    pageOutOfRange: 'Page {{index}} hors limites (0-{{last}})',
    extractFailed: "Impossible d'extraire la page : {{entry}}",
    closed: 'Archive fermée : {{path}}',
    entryTooLarge: "Page trop volumineuse pour être lue : {{entry}}",
    imageTooLarge: "Image trop grande pour être affichée : {{entry}} ({{width}} × {{height}} px)",
    fileNotFound: 'Fichier introuvable : il a été déplacé ou supprimé.',
    openFailed: "Impossible d'ouvrir ce fichier : {{message}}",
  },
  decoder: {
    crashed: "Fichier illisible : le décodeur s'est arrêté de façon inattendue.",
    timeout: 'Fichier illisible : la lecture a pris trop de temps et a été abandonnée.',
  },
  database: {
    notWritable: "Impossible d'écrire dans {{directory}}.",
  },
  data: {
    exportFailed: "Impossible d'écrire l'export : {{message}}",
    clearFailed: 'Impossible de vider la bibliothèque : {{message}}',
  },
  library: {
    resyncRunning: 'Une resynchronisation est déjà en cours.',
    organizationOff: "L'organisation de la bibliothèque est désactivée, ou n'a pas de dossier.",
    organizationFolderUnreachable: 'Le dossier organisé est inaccessible : {{folder}}',
    organizationExpired: 'Ces BD ne peuvent plus être déplacées d’ici : ajoutez-les à nouveau ou resynchronisez.',
    organizeRunning: 'Une resynchronisation ou une organisation de la bibliothèque est déjà en cours.',
  },
  import: {
    notJson: "Fichier illisible : ce n'est pas du JSON valide.",
    notExport: "Fichier non reconnu : ce n'est pas un export Tankōbon (version 1).",
  },
  readingLists: {
    notFound: 'Liste de lecture introuvable.',
    emptyName: 'Le nom de la liste ne peut pas être vide.',
    listsChanged: 'Les listes ont changé entre-temps : réessaie.',
    listChanged: 'La liste a changé entre-temps : réessaie.',
    full: 'La liste « {{name}} » est pleine ({{max}} livres au maximum).',
    entryGone: "Ce livre n'est plus dans la bibliothèque.",
  },
  users: {
    notFound: 'Cet utilisateur n’existe plus.',
    emptyNickname: 'Le pseudo ne peut pas être vide.',
    nicknameTooLong: 'Le pseudo ne peut pas dépasser {{max}} caractères.',
    nicknameTaken: 'Quelqu’un s’appelle déjà « {{nickname}} ».',
    avatarFormat: 'Cette image est inutilisable : choisis une image PNG, JPEG ou WebP.',
    avatarTooLarge: 'Cette image est trop volumineuse.',
    avatarUnreadable: 'Impossible de lire cette image : {{message}}',
    lastUser: 'Le dernier utilisateur ne peut pas être supprimé.',
  },
  metadata: {
    emptyQuery: 'Saisis un titre ou une série à rechercher.',
    noSource: "Aucune source de métadonnées n'est configurée : active-en une dans Paramètres › Métadonnées.",
    notResponding: '{{source}} : le service ne répond pas.',
    unreachable: '{{source}} : impossible de joindre le service.',
    unreadable: '{{source}} : réponse illisible (HTTP {{status}}).',
    quota: '{{source}} : quota de requêtes dépassé. Réessaie plus tard, ou renseigne une clé API dans les paramètres.',
    sourceError: '{{source}} : {{message}}',
    httpError: 'erreur HTTP {{status}}',
    pageNotFound: "{{source}} : cette page n'existe pas.",
    invalidKey: '{{source}} : clé API invalide.',
    notAlbumPage: '{{source}} : cette page ne décrit pas un album.',
    notAlbumUrl: "{{source}} : ce lien n'est pas celui d'une fiche album (https://www.bedetheque.com/BD-….html).",
    redirected: "{{source}} : le service redirige vers un autre site, requête refusée.",
    tooLarge: '{{source}} : la réponse est trop volumineuse.',
  },
};

export default errors;
