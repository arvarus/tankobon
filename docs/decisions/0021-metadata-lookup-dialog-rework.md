# 0021. Metadata lookup dialog: explicit search, more page sources, saved to the `.nfo`

- **Status:** Accepted
- **Date:** 2026-10-19

## Context

The lookup dialog ([ADR 0005](./0005-metadata-lookup-public-apis.md), [ADR 0006](./0006-bedetheque-album-page-scraping.md)) searched as soon as it opened, with a query guessed from the file name, and queried every enabled API. A pasted Bédéthèque link was recognized in the same field as the search text, and it was the only site supported. Applying the result only wrote the database, so the `.nfo` beside the comic, which the scan reads back, stayed stale.

BDfugue (a bookshop) and Nautiljon (a manga database) are the next sites users want to read from a link. Neither has a public API, and this environment's authors could not fetch their pages when this was written.

## Decision

- **Nothing is searched on opening.** The dialog shows its options first: *Search in APIs* (text, volume, one checkbox per enabled API, sent as `MetadataQuery.sources`) or *From a page link*. The search starts when the user presses the button, and the "Arrêter" button abandons it: the renderer ignores the answer (`latestSearch`), without interrupting the main process.
- **More sites by link**: BDfugue and Nautiljon join Bédéthèque as link-only sources (`pageSourceOf()`). Rather than parsing their markup, `parseStructuredPage()` reads the standard metadata the pages embed for search engines and link previews (schema.org JSON-LD, then Open Graph tags). Their authors get the generic `author` role, like Google Books'.
- **Saving goes through `metadata:apply`**, which updates the entry, rewrites the `.nfo` (replacing it, unlike the resynchronization's write-if-missing) and makes the cover thumbnail if the book has none. The manual edit form keeps `library:update-metadata`.

## Consequences

- The parsers rely on conventions more stable than the sites' markup, but a site that publishes no JSON-LD or Open Graph title is refused ("cette page ne décrit pas un livre"). The fixtures of `structured-page.test.ts` were written from the conventions, not from real pages: check them against a real BDfugue and Nautiljon page and extend them if a field is missed.
- Stopping a search doesn't save Comic Vine's quota: its sequential requests continue in the main process until they end.
- The `.nfo` is overwritten on every applied lookup, so a hand-edited `.nfo` is replaced by what the user just accepted. The cover step only helps books whose thumbnail is missing; it does not download the source's cover.
- The CSP's `img-src` gains `*.bdfugue.com` and `*.nautiljon.com` for the result thumbnails.

## Alternatives considered

- **Cancelling in the main process** (an id per search and an `AbortSignal` through the HTTP helpers): rejected for now; it adds a channel and plumbing in every client for a search that lasts a few seconds.
- **Scraping each site's markup** like Bédéthèque: rejected, as it couldn't be written or tested without real pages and breaks on each redesign.
