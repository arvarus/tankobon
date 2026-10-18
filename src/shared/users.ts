/**
 * The people who share the app, shared between the main process and the renderer (via preload).
 * A user has a nickname and, optionally, a profile picture; there is no password.
 * @module
 */

/** Id of the user every database starts with: it receives the data that predates the users. */
export const DEFAULT_USER_ID = 'default';

/** Longest nickname accepted, in characters. */
export const MAX_NICKNAME_LENGTH = 40;

/** Largest profile picture stored, in bytes (the renderer shrinks it to 256 × 256 px first, a few tens of kilobytes). */
export const MAX_AVATAR_BYTES = 262_144;

/** Largest picture file the picker reads, in bytes, before the renderer shrinks it. */
export const MAX_AVATAR_SOURCE_BYTES = 20 * 1024 * 1024;

/** Side of the square profile picture the renderer produces, in pixels. */
export const AVATAR_SIZE = 256;

/** A user as the renderer sees it. */
export interface UserProfile {
  id: string;
  nickname: string;
  /** The profile picture (PNG, JPEG or WebP), or `null` for the default contact-style image. */
  avatar: Uint8Array | null;
  /** Media type of `avatar`, `null` when there is none. */
  avatarType: AvatarType | null;
}

/** Every user and which one is using the app. */
export interface UsersState {
  /** Everyone, in the order they were created. */
  users: UserProfile[];
  /** The user whose ratings, progress, lists and settings the app shows. */
  activeId: string;
}

/** Answer to a change of user: the user as saved, or the reason it was refused. */
export type UserResult = { status: 'ok'; user: UserProfile } | { status: 'error'; message: string };

/** Answer to the profile picture picker: the picked file's bytes (to be shrunk by the renderer), or why there are none. */
export type PickAvatarResult =
  | { status: 'ok'; bytes: Uint8Array }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/** Media types accepted for a profile picture. */
export type AvatarType = 'image/png' | 'image/jpeg' | 'image/webp';

/** A nickname as stored: trimmed, inner runs of whitespace collapsed to one space. */
export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** The media type of a PNG, JPEG or WebP image from its first bytes, or `null` for anything else. */
export function avatarType(bytes: Uint8Array): AvatarType | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const ascii = (start: number) => String.fromCharCode(...bytes.subarray(start, start + 4));
  if (bytes.length >= 12 && ascii(0) === 'RIFF' && ascii(8) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}
