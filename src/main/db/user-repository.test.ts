import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { applyLanguage } from '../../shared/i18n';
import { DEFAULT_USER_ID, MAX_AVATAR_BYTES } from '../../shared/users';
import { migrate } from './schema';
import { UserRepository } from './user-repository';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

let repo: UserRepository;

beforeEach(() => {
  applyLanguage('fr');
  const db = new DatabaseSync(':memory:');
  migrate(db);
  repo = new UserRepository(db);
});

describe('UserRepository', () => {
  it('starts with the first user, active, and the default picture', () => {
    expect(repo.list()).toHaveLength(1);
    expect(repo.activeId()).toBe(DEFAULT_USER_ID);
    expect(repo.list()[0]).toMatchObject({ id: DEFAULT_USER_ID, avatar: null, avatarType: null });
  });

  it('creates a user without switching to them', () => {
    const result = repo.create('  Alice  ');
    expect(result).toMatchObject({ status: 'ok', user: { nickname: 'Alice', avatar: null } });
    expect(repo.list().map((user) => user.nickname)).toHaveLength(2);
    expect(repo.activeId()).toBe(DEFAULT_USER_ID);
  });

  it('refuses an empty, too long or already taken nickname', () => {
    repo.create('Alice');
    expect(repo.create('   ')).toMatchObject({ status: 'error', message: 'Le pseudo ne peut pas être vide.' });
    expect(repo.create('x'.repeat(41)).status).toBe('error');
    expect(repo.create('alice')).toMatchObject({ status: 'error' });
    expect(repo.list()).toHaveLength(2);
  });

  it('switches users, and reopens on the last one', () => {
    const alice = repo.create('Alice');
    if (alice.status !== 'ok') throw new Error('not created');

    expect(repo.switchTo(alice.user.id)).toBe(true);
    expect(repo.activeId()).toBe(alice.user.id);

    // A new repository on the same database (the next start) finds the same active user.
    const db = (repo as unknown as { db: DatabaseSync }).db;
    expect(new UserRepository(db).activeId()).toBe(alice.user.id);
    expect(repo.switchTo('nobody')).toBe(false);
    expect(repo.activeId()).toBe(alice.user.id);
  });

  it('does not make a user created later the active one', () => {
    const alice = repo.create('Alice');
    const bob = repo.create('Bob');
    if (alice.status !== 'ok' || bob.status !== 'ok') throw new Error('not created');
    const db = (repo as unknown as { db: DatabaseSync }).db;
    expect(new UserRepository(db).activeId()).toBe(DEFAULT_USER_ID);
  });

  it('renames a user, keeping nicknames unique ignoring case', () => {
    const alice = repo.create('Alice');
    if (alice.status !== 'ok') throw new Error('not created');

    expect(repo.rename(alice.user.id, 'Alicia')).toMatchObject({ status: 'ok', user: { nickname: 'Alicia' } });
    // Changing only the case of one's own nickname is allowed.
    expect(repo.rename(alice.user.id, 'ALICIA')).toMatchObject({ status: 'ok', user: { nickname: 'ALICIA' } });
    const first = repo.get(DEFAULT_USER_ID)!;
    expect(repo.rename(alice.user.id, first.nickname.toUpperCase()).status).toBe('error');
    expect(repo.rename('nobody', 'X').status).toBe('error');
  });

  it('stores and removes a picture, checking its format and size', () => {
    expect(repo.setAvatar(DEFAULT_USER_ID, PNG)).toMatchObject({
      status: 'ok',
      user: { avatarType: 'image/png', avatar: PNG },
    });
    expect(repo.get(DEFAULT_USER_ID)?.avatar).toEqual(PNG);

    expect(repo.setAvatar(DEFAULT_USER_ID, new TextEncoder().encode('<svg/>')).status).toBe('error');
    expect(repo.setAvatar(DEFAULT_USER_ID, new Uint8Array(MAX_AVATAR_BYTES + 1).fill(0xff)).status).toBe('error');
    expect(repo.get(DEFAULT_USER_ID)?.avatar).toEqual(PNG);

    expect(repo.setAvatar(DEFAULT_USER_ID, null)).toMatchObject({ status: 'ok', user: { avatar: null, avatarType: null } });
  });
});
