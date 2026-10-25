# 0026. Bédéthèque: finding the album from the series name

- **Status:** Accepted
- **Date:** 2026-10-25

## Context

[ADR 0006](./0006-bedetheque-album-page-scraping.md) made Bédéthèque a page to paste, not a search source: the user finds the album on the site, then pastes its link. It rejected a search source because it would scrape the search results on every lookup, "for results the user can find faster on the site itself".

In practice the user already knows the series and the volume (the lookup dialog starts from the book's series and volume, or from its file name), so leaving the app to find a link is the slow part. The site also offers what makes a sober lookup possible: its search box answers with a small JSON (`https://www.bdgest.com/ajax/tout?term=…`), and a series page lists all its albums, specials and omnibuses included, in one box with a direct link to each album page.

## Decision

- Bédéthèque becomes a **search source** next to Comic Vine and Google Books (`MetadataApiSource`, `MetadataQuery.sources`), but one that only runs when the user ticks its box in the lookup dialog. The box is always offered; the personal setting `AppSettings.bedethequeSearchByDefault` (Paramètres › Métadonnées, off by default) says whether it starts ticked. When a query names no sources (not what the dialog sends), the setting decides.
- A search is **at most three sequential requests**: the search box's JSON for the series, the series page for its album list, the album page for the credits. The series is chosen by its name (the translations the site lists, `(en allemand)`…, only count when nothing else matches), the album by its number (`3`, `HS1`, `INT01`; the only numbered album of a one-shot). The album page is read by the parser of ADR 0006, unchanged. The series' album list is remembered for 10 minutes, so choosing several volumes of one series reads its page once.
- When the volume isn't in the series, or none is asked and the series has several albums, the series' albums come back as candidates (30 at most) built from the list alone; reading the album page of the one picked completes it with the credits. Nothing is written without the usual review.
- Nothing runs in the background and nothing is looked up in bulk: one search is one book, started by a button.

## Consequences

- The parser depends on two more pieces of the site: the JSON of the search box and the `bdt-box-albums-liste` markup. Both are pinned by `bedetheque.test.ts` (fixtures cut from real Blacksad pages), so a redesign starts by refreshing them. The preview of four covers (`bdt-sh-tomes`) and the paged "Détail des albums" are deliberately not read: the first is incomplete, the second is cut every ten albums.
- The search box lives on `bdgest.com` and the pages on `bedetheque.com`; each request stays on its own site, so the redirect check of `http-json.ts` still holds. The series page is reached through `serie/index/s/<id>`, the address the site's own box navigates to.
- A series page is a larger page than an album page, but stays well below `MAX_RESPONSE_BYTES`.
- The pasted-link way of ADR 0006 is unchanged and needs no setting.

## Alternatives considered

- **Reading the search results page** (`bedetheque.com/search/tout?RechTexte=…`): a third markup to maintain, when the box's JSON is one flat list.
- **Reading the paged "Détail des albums"**: ten albums per page, so a volume beyond the tenth needs the "Tout" page; the album box lists everything at once.
- **A setting that turns the source on or off like Comic Vine's**: Bédéthèque has no key and costs nothing to leave unticked; the setting only chooses the box's starting state, and the box is always there to tick for one search.
- **Searching automatically when the series and volume are known**: requests the user didn't ask for, which ADR 0006 wanted to avoid.
