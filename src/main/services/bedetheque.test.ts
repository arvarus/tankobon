import { beforeAll, describe, expect, it, vi } from 'vitest';

import { applyLanguage } from '../../shared/i18n';
import { isBedethequeAlbumUrl, pageSourceOf } from '../../shared/metadata';
import { fetchBedethequeAlbum, parseBedethequeAlbum } from './bedetheque';
import type { HttpOptions } from './http-json';

// The user-facing messages are checked in French; English is the interface's default.
beforeAll(() => applyLanguage('fr'));

const URL_1 = 'https://www.bedetheque.com/BD-Winged-Mermaids-Tome-1-311296.html';

/** A trimmed-down album page, keeping the markup of a real one around what the parser reads. */
function albumPage({
  subtitle = '1<span class="bdt-numa"></span>. Tome 1',
  deposit = '<b>09/2017</b>\n<meta itemprop="datePublished" content="2017-09-20">\n(20 septembre 2017)',
} = {}) {
  return `<!DOCTYPE html><html><head><title>Winged Mermaids -1- Tome 1</title></head><body>
<section class="bdt-ah">
  <div class="bdt-ah-cover">
    <img itemprop="image" src="https://www.bedetheque.com/media/Couvertures/Couv_311296.jpg" alt="Couverture">
  </div>
  <div class="bdt-ah-main">
    <div class="bdt-ah-top"><div>
      <h1><a href="https://www.bedetheque.com/serie-57963-BD-Winged-Mermaids.html" title="Winged Mermaids">Winged Mermaids</a></h1>
      ${subtitle === null ? '' : `<h2 class="bdt-ah-sub">\n ${subtitle}  </h2>`}
    </div></div>
    <meta itemprop="name" content="Winged Mermaids - Tome 1">
    <meta itemprop="alternativeheadline" content="Tome 1">
    <div class="bdt-ah-auteurs liste-auteurs">
      <span><a href="https://www.bedetheque.com/auteur-13741-BD-Shiono-Etorouji.html" title="Voir la fiche de Shiono, Etorouji">Shiono, Etorouji</a>   <small>(Scénario)</small></span>
      <span><a href="https://www.bedetheque.com/auteur-13741-BD-Shiono-Etorouji.html" title="Voir la fiche de Shiono, Etorouji">Shiono, Etorouji</a>   <small>(Dessin)</small></span>
      <span><a href="https://www.bedetheque.com/auteur-477-BD-NB.html" title="Voir la fiche de <N&B>">&lt;N&amp;B&gt;</a>   <small>(Couleurs)</small></span>
      <span><a href="https://www.bedetheque.com/auteur-1-BD-Van-Hamme-Jean.html">Van Hamme, Jean</a> <small>(Traduction)</small></span>
      <span><a href="https://www.bedetheque.com/auteur-2-BD-Herge.html">Hergé</a> <small>(Couverture)</small></span>
    </div>
    <div class="bdt-ah-meta"><ul class="bdt-ah-pastilles">
      <li title="Dépôt légal">${deposit}</li>
      <li><b itemprop="numberOfPages">200</b> pages</li>
    </ul></div>
    <meta itemprop="inLanguage" content="fr">
  </div>
</section>
<section class="bdt-shelf" id="albums-serie">
  <h1>Autre série</h1>
  <h2 class="bdt-ah-sub">2. Tome 2</h2>
</section>
<article itemprop="review"><time itemprop="datePublished" datetime="2020-10-30">le 30/10/2020</time></article>
</body></html>`;
}

describe('isBedethequeAlbumUrl', () => {
  it('accepts album pages only', () => {
    expect(isBedethequeAlbumUrl(URL_1)).toBe(true);
    expect(isBedethequeAlbumUrl(`  ${URL_1.replace('https', 'http').replace('www.', '')}  `)).toBe(true);
    expect(isBedethequeAlbumUrl('https://www.bedetheque.com/serie-57963-BD-Winged-Mermaids.html')).toBe(false);
    expect(isBedethequeAlbumUrl('https://example.com/BD-Winged-Mermaids-Tome-1-311296.html')).toBe(false);
    expect(isBedethequeAlbumUrl('Winged Mermaids')).toBe(false);
  });
});

describe('parseBedethequeAlbum', () => {
  it('reads the main album block', () => {
    expect(parseBedethequeAlbum(albumPage(), URL_1)).toEqual({
      source: 'bedetheque',
      sourceId: '311296',
      sourceUrl: URL_1,
      coverUrl: 'https://www.bedetheque.com/media/Couvertures/Couv_311296.jpg',
      title: 'Tome 1',
      series: 'Winged Mermaids',
      volume: '1',
      releaseDate: '2017-09-20',
      language: 'fr',
      credits: [
        { firstName: 'Etorouji', lastName: 'Shiono', role: 'writer' },
        { firstName: 'Etorouji', lastName: 'Shiono', role: 'artist' },
        { firstName: '', lastName: 'Hergé', role: 'cover' },
      ],
    });
  });

  it('keeps a volume letter and the title after the number', () => {
    const candidate = parseBedethequeAlbum(
      albumPage({ subtitle: '12<span class="bdt-numa">a</span>. L&#039;Affaire Tournesol' }),
      URL_1,
    );
    expect(candidate.volume).toBe('12a');
    expect(candidate.title).toBe("L'Affaire Tournesol");
  });

  it('has no volume for a one-shot', () => {
    const candidate = parseBedethequeAlbum(albumPage({ subtitle: 'Le Grand Voyage' }), URL_1);
    expect(candidate.volume).toBeNull();
    expect(candidate.title).toBe('Le Grand Voyage');
  });

  it('falls back to the alternative headline when there is no subtitle', () => {
    expect(parseBedethequeAlbum(albumPage({ subtitle: null as unknown as string }), URL_1).title).toBe('Tome 1');
  });

  it('keeps only the month when the exact day is unknown', () => {
    const deposit = '<b>03/1977</b> <meta itemprop="datePublished" content="1977-03-01">';
    expect(parseBedethequeAlbum(albumPage({ deposit }), URL_1).releaseDate).toBe('1977-03');
    expect(parseBedethequeAlbum(albumPage({ deposit: '<b>1977</b>' }), URL_1).releaseDate).toBe('1977');
  });

  it('rejects a page without an album block', () => {
    expect(() => parseBedethequeAlbum('<html><body>Série</body></html>', URL_1)).toThrow(
      'Bédéthèque : cette page ne décrit pas un album.',
    );
  });
});

describe('fetchBedethequeAlbum', () => {
  const http = (fetch: (input: string | URL | Request) => Promise<Response>): HttpOptions => ({
    fetch: fetch as typeof globalThis.fetch,
    userAgent: 'Tankobon/test',
    timeoutMs: 1000,
  });

  it('downloads the page over https, without the fragment', async () => {
    const fetch = vi.fn(async () => new Response(albumPage(), { status: 200 }));
    const candidate = await fetchBedethequeAlbum(`${URL_1.replace('https', 'http')}#ed-311296`, http(fetch));
    expect(fetch).toHaveBeenCalledWith(URL_1, expect.anything());
    expect(candidate.sourceUrl).toBe(URL_1);
    expect(candidate.series).toBe('Winged Mermaids');
  });

  it('refuses other links without fetching', async () => {
    const fetch = vi.fn<(input: string | URL | Request) => Promise<Response>>();
    await expect(fetchBedethequeAlbum('https://example.com/', http(fetch))).rejects.toThrow(/fiche album/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a missing page', async () => {
    const fetch = vi.fn(async () => new Response('Not found', { status: 404 }));
    await expect(fetchBedethequeAlbum(URL_1, http(fetch))).rejects.toThrow("Bédéthèque : cette page n'existe pas.");
  });
});

describe('pageSourceOf', () => {
  it('tells the supported sites by the link', () => {
    expect(pageSourceOf(URL_1)).toBe('bedetheque');
    expect(pageSourceOf('https://www.bdfugue.com/knights-of-sidonia-tome-15')).toBe('bdfugue');
    expect(pageSourceOf('https://www.nautiljon.com/mangas/knights+of+sidonia/volume-1,12218.html')).toBe('nautiljon');
  });

  it('refuses anything else', () => {
    expect(pageSourceOf('https://www.bdfugue.com/')).toBeNull();
    expect(pageSourceOf('https://www.nautiljon.com/mangas/knights+of+sidonia/')).toBeNull();
    expect(pageSourceOf('https://example.com/knights-of-sidonia-tome-15')).toBeNull();
    expect(pageSourceOf('not a link')).toBeNull();
  });
});
