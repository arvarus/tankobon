import { describe, expect, it } from 'vitest';

import { buildReview, isEmptyUpdate, reviewToUpdate } from './metadata-review';
import type { LibraryEntry } from '@/shared/library';
import type { MetadataCandidate } from '@/shared/metadata';

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'id',
    path: '/comics/Blacksad_T02.cbz',
    title: 'Blacksad_T02',
    pageCount: 10,
    currentPage: 0,
    addedAt: '2026-01-01T00:00:00.000Z',
    lastOpenedAt: '2026-01-01T00:00:00.000Z',
    fileCount: 10,
    fileSize: 1000,
    rating: 0,
    tags: [],
    titleLocked: false,
    series: null,
    volume: null,
    releaseDate: null,
    language: null,
    avgPageWidth: null,
    avgPageHeight: null,
    credits: [],
    ...overrides,
  };
}

const candidate: MetadataCandidate = {
  source: 'googlebooks',
  sourceId: 'g1',
  sourceUrl: null,
  coverUrl: null,
  title: 'Arctic Nation',
  series: 'Blacksad',
  volume: '2',
  releaseDate: '2003',
  language: null,
  credits: [
    { firstName: 'Juan', lastName: 'Díaz Canales', role: 'author' },
    { firstName: 'Juanjo', lastName: 'Guarnido', role: 'author' },
  ],
};

describe('buildReview', () => {
  it('offers the candidate\'s cover, not accepted at first', () => {
    const review = buildReview(entry({}), { ...candidate, coverUrl: 'https://books.google.com/c.jpg' });
    expect(review.coverUrl).toBe('https://books.google.com/c.jpg');
    expect(review.coverAccepted).toBe(false);
  });

  it('lists the fields the candidate knows, pre-accepting the ones that change', () => {
    const review = buildReview(entry({ series: 'Blacksad' }), candidate);
    expect(review.fields).toEqual([
      { field: 'title', current: 'Blacksad_T02', proposed: 'Arctic Nation', accepted: true },
      { field: 'series', current: 'Blacksad', proposed: 'Blacksad', accepted: false },
      { field: 'volume', current: null, proposed: '2', accepted: true },
      { field: 'releaseDate', current: null, proposed: '2003', accepted: true },
    ]);
  });

  it('keeps the current credits and proposes only the new ones', () => {
    const review = buildReview(
      entry({ credits: [{ personId: 'p', firstName: 'juanjo', lastName: 'guarnido', role: 'author' }] }),
      candidate,
    );
    expect(review.credits.map((c) => [c.origin, c.lastName, c.accepted])).toEqual([
      ['current', 'guarnido', true],
      ['proposed', 'Díaz Canales', true],
    ]);
  });
});

describe('reviewToUpdate', () => {
  it('writes the accepted fields and the accepted credits', () => {
    const current = entry();
    const review = buildReview(current, candidate);
    review.fields[2] = { ...review.fields[2], accepted: false };
    review.credits[1] = { ...review.credits[1], accepted: false };

    expect(reviewToUpdate(current, review)).toEqual({
      title: 'Arctic Nation',
      series: 'Blacksad',
      releaseDate: '2003',
      credits: [{ firstName: 'Juan', lastName: 'Díaz Canales', role: 'author' }],
    });
  });

  it('clears an emptied field but never the title', () => {
    const current = entry();
    const review = buildReview(current, candidate);
    review.fields = review.fields.map((row) => ({ ...row, proposed: ' ', accepted: true }));
    review.credits = [];

    expect(reviewToUpdate(current, review)).toEqual({ series: null, volume: null, releaseDate: null });
  });

  it('removes an unticked current credit, and leaves credits out when nothing changed', () => {
    const current = entry({ credits: [{ personId: 'p', firstName: '', lastName: 'Hergé', role: 'author' }] });
    const review = buildReview(current, { ...candidate, credits: [] });
    review.fields = [];

    const unchanged = reviewToUpdate(current, review);
    expect(unchanged).toEqual({});
    expect(isEmptyUpdate(unchanged)).toBe(true);

    review.credits[0] = { ...review.credits[0], accepted: false };
    expect(reviewToUpdate(current, review)).toEqual({ credits: [] });
  });
});
