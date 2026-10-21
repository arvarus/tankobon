import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ARTICLES,
  MAX_ARTICLES,
  formatArticleList,
  isArticle,
  isArticleList,
  moveArticleToEnd,
  parseArticleList,
} from './articles';

describe('moveArticleToEnd', () => {
  it('moves a leading article to the end and capitalizes the first word', () => {
    expect(moveArticleToEnd('Le vent du nord', DEFAULT_ARTICLES)).toBe('Vent du nord (Le)');
    expect(moveArticleToEnd('The Walking Dead', DEFAULT_ARTICLES)).toBe('Walking Dead (The)');
    expect(moveArticleToEnd('les Schtroumpfs', DEFAULT_ARTICLES)).toBe('Schtroumpfs (les)');
  });

  it('attaches an article ending with an apostrophe to the next word', () => {
    expect(moveArticleToEnd("L'été en pente douce", DEFAULT_ARTICLES)).toBe("Été en pente douce (L')");
    expect(moveArticleToEnd('D’Artagnan', DEFAULT_ARTICLES)).toBe('Artagnan (D’)');
  });

  it('needs a space after any other article', () => {
    expect(moveArticleToEnd('Lecteur', DEFAULT_ARTICLES)).toBe('Lecteur');
    expect(moveArticleToEnd('Another day', DEFAULT_ARTICLES)).toBe('Another day');
    expect(moveArticleToEnd('Theodore', DEFAULT_ARTICLES)).toBe('Theodore');
  });

  it('leaves a name that is only an article, or starts with none, unchanged', () => {
    expect(moveArticleToEnd('Le', DEFAULT_ARTICLES)).toBe('Le');
    expect(moveArticleToEnd("L'", DEFAULT_ARTICLES)).toBe("L'");
    expect(moveArticleToEnd('Tintin au Tibet', DEFAULT_ARTICLES)).toBe('Tintin au Tibet');
    expect(moveArticleToEnd('Le vent', [])).toBe('Le vent');
  });

  it('uses the longest matching article and ignores surrounding spaces', () => {
    expect(moveArticleToEnd('  de la terre à la lune ', ['de', 'de la'])).toBe('Terre à la lune (de la)');
  });
});

describe('isArticleList', () => {
  it('accepts the defaults and refuses anything unsafe', () => {
    expect(isArticleList([...DEFAULT_ARTICLES])).toBe(true);
    expect(isArticleList([])).toBe(true);
    expect(isArticleList([''])).toBe(false);
    expect(isArticleList([' le'])).toBe(false);
    expect(isArticleList(['a/b'])).toBe(false);
    expect(isArticleList(['x'.repeat(13)])).toBe(false);
    expect(isArticleList(Array.from({ length: MAX_ARTICLES + 1 }, () => 'le'))).toBe(false);
    expect(isArticleList('le')).toBe(false);
  });

  it('accepts accents, apostrophes and a space inside', () => {
    expect(isArticle("l'")).toBe(true);
    expect(isArticle('de la')).toBe(true);
    expect(isArticle('él')).toBe(true);
    expect(isArticle("'")).toBe(false);
  });
});

describe('parseArticleList', () => {
  it('reads comma-separated articles, dropping blanks and duplicates', () => {
    expect(parseArticleList(" le, La ,, LE, l' ")).toEqual(['le', 'La', "l'"]);
    expect(parseArticleList('')).toEqual([]);
  });

  it('returns null when an article is unusable', () => {
    expect(parseArticleList('le, a/b')).toBeNull();
    expect(parseArticleList('le, 12')).toBeNull();
  });

  it('round-trips the defaults', () => {
    expect(parseArticleList(formatArticleList(DEFAULT_ARTICLES))).toEqual([...DEFAULT_ARTICLES]);
  });
});
