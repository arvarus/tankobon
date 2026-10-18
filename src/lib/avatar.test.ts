import { describe, expect, it } from 'vitest';

import { squareCrop } from './avatar';

describe('squareCrop', () => {
  it('keeps the centre of a landscape picture', () => {
    expect(squareCrop(400, 200)).toEqual({ x: 100, y: 0, size: 200 });
  });

  it('keeps the centre of a portrait picture', () => {
    expect(squareCrop(200, 301)).toEqual({ x: 0, y: 50, size: 200 });
  });

  it('keeps a square picture whole', () => {
    expect(squareCrop(256, 256)).toEqual({ x: 0, y: 0, size: 256 });
  });
});
