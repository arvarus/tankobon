import { describe, expect, it } from 'vitest';

import { avatarType, normalizeNickname } from './users';

describe('normalizeNickname', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeNickname('  Jean   Pierre \n')).toBe('Jean Pierre');
  });
});

describe('avatarType', () => {
  it('recognises PNG, JPEG and WebP by their first bytes', () => {
    expect(avatarType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(avatarType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    const webp = new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0))));
    expect(avatarType(webp)).toBe('image/webp');
  });

  it('refuses anything else', () => {
    expect(avatarType(new Uint8Array([]))).toBeNull();
    expect(avatarType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(avatarType(new TextEncoder().encode('GIF89a......'))).toBeNull();
  });
});
