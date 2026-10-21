import { describe, expect, it } from 'vitest';

import { MAX_COVER_ZOOM, coverSourceRect } from './cover-crop';

describe('coverSourceRect', () => {
  it('keeps the largest 2:3 part of a wide picture, centred', () => {
    const rect = coverSourceRect(3000, 1500, 1, 0.5, 0.5);
    expect(rect.sh).toBe(1500);
    expect(rect.sw).toBeCloseTo(1000);
    expect(rect.sx).toBeCloseTo(1000);
    expect(rect.sy).toBe(0);
  });

  it('keeps the whole of a picture that already is 2:3', () => {
    const rect = coverSourceRect(600, 900, 1, 0.5, 0.5);
    expect(rect).toEqual({ sx: 0, sy: 0, sw: 600, sh: 900 });
  });

  it('shows less of the picture when zoomed, and keeps the 2:3 proportions', () => {
    const rect = coverSourceRect(600, 900, 2, 0, 0);
    expect(rect.sw).toBe(300);
    expect(rect.sh).toBe(450);
    expect(rect.sx).toBe(0);
    expect(rect.sy).toBe(0);
  });

  it('moves inside the room left and never leaves the picture', () => {
    const rect = coverSourceRect(600, 900, 2, 5, -3);
    expect(rect.sx).toBe(300);
    expect(rect.sy).toBe(0);
    const bottom = coverSourceRect(600, 900, 2, 1, 1);
    expect(bottom.sy + bottom.sh).toBe(900);
  });

  it('clamps the zoom', () => {
    expect(coverSourceRect(600, 900, 100, 0, 0).sw).toBe(600 / MAX_COVER_ZOOM);
    expect(coverSourceRect(600, 900, 0.2, 0, 0).sw).toBe(600);
  });
});
