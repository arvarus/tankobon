# 0006. Bédéthèque album pages read from a pasted link

- **Status:** Accepted; its "not a search source" part is superseded by [0026](./0026-bedetheque-series-search.md)
- **Date:** 2026-10-01

## Context

[ADR 0005](./0005-metadata-lookup-public-apis.md) added a metadata lookup in Comic Vine and Google Books, and left Bédéthèque for later because it has no API. Yet Bédéthèque (the BDGest' database) is the reference for French-language BD and manga: it has the series, the volume number, the legal deposit date and every credit with its role, where Google Books only lists "authors" and Comic Vine barely covers BD.

Its pages are server-rendered HTML with a stable markup for the album block (`<section class="bdt-ah">`, `schema.org` `itemprop` attributes, a `liste-auteurs` block giving each person's role). Searching the site, on the other hand, means driving its search forms, and running many automated requests against a site that doesn't offer an API.

## Decision

- Bédéthèque is **not a search source**. The user finds the album on bedetheque.com, then pastes the album page's link (`https://www.bedetheque.com/BD-….html`) in the lookup dialog's search field. Pasting the link is the opt-in: there is no setting to enable it.
- The page is downloaded by the **main process** (`metadata:from-page`, `src/main/services/bedetheque.ts`), through the same `net.fetch` options as the APIs, and parsed with a few targeted regular expressions into a `MetadataCandidate` with `source: 'bedetheque'`. One request per pasted link, nothing else.
- The dialog then skips the results list and goes straight to the usual review step: nothing is written without confirmation.
- The renderer's CSP only gains `img-src https://www.bedetheque.com`, for the cover thumbnail.

## Consequences

- The parser depends on Bédéthèque's markup. A redesign of the site breaks it, most likely as a page "that doesn't describe an album" or missing fields; `bedetheque.test.ts` pins the markup it relies on, so a fix starts by updating that fixture from a fresh page.
- Only the main album block is read: other albums of the series and the edition details further down the page are ignored. The release date is the legal deposit, with its exact day only when the page spells it out.
- Bédéthèque's role labels map to `CreditRole` (`Scénario` → writer, `Dessin` → artist, `Couleurs`, `Encrage`, `Lettrage`, `Couverture`); other roles (translation, preface, storyboard…) and placeholders such as `<N&B>` or `<Collectif>` are dropped.
- Adding another site that works by pasted link means a parser returning a `MetadataCandidate`, a URL check, and a branch in `fetchMetadataPage()`.

## Alternatives considered

- **Bédéthèque as a third search source**: would scrape the site's search results on every lookup, multiplying automated requests, for results the user can find faster on the site itself.
- **A DOM parser (`linkedom`, `cheerio`…)**: sturdier against small markup changes, but a new dependency in the main bundle for a handful of fields; the regular expressions are scoped to the album block and covered by tests.
- **BDGest' paid API**: reserved to partners, not available to a personal app.
