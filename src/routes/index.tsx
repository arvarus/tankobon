import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BookCover } from '@/components/book-cover';
import { BookDetails } from '@/components/book-row';
import { Button } from '@/components/ui/button';
import { useLibrary } from '@/hooks/use-library';
import { continueReading } from '@/lib/continue-reading';
import { pickRandomUnread } from '@/lib/home-picks';
import { recentlyAdded } from '@/lib/recent-books';
import type { LibraryEntry } from '@/shared/library';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/** The page shown when the app starts: "continue reading", "recently added" and "to read" (random unread books) blocks, more will follow. */
function HomePage() {
  const { t } = useTranslation('home');
  const library = useLibrary();
  const books = library ? continueReading(library) : [];
  const recent = useMemo(() => (library ? recentlyAdded(library) : []), [library]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      {books.length > 0 && (
        <section className="mt-6" aria-labelledby="continue-reading">
          <h2 id="continue-reading" className="text-lg font-medium">
            {t('continueReading')}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-4">
            {books.map((entry) => (
              <li key={entry.id} className="w-32">
                <Link to="/reader" search={{ book: entry.id }} className="block rounded-md hover:opacity-90">
                  <BookCover entryId={entry.id} title={entry.title} className="aspect-[2/3] w-full" />
                  <p className="mt-1 truncate text-sm font-medium" title={entry.title}>
                    {entry.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('continueReadingPage', { page: entry.currentPage + 1, total: entry.pageCount })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-6" aria-labelledby="recently-added">
        <h2 id="recently-added" className="text-lg font-medium">
          {t('recentlyAdded')}
        </h2>
        {library && recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('recentlyAddedEmpty')}</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-4">
            {recent.map((entry) => (
              <li key={entry.id} className="w-32">
                <Link
                  to="/reader"
                  search={{ book: entry.id }}
                  aria-label={t('openBook', { title: entry.title })}
                  className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <BookCover entryId={entry.id} title={entry.title} className="aspect-[2/3] w-full" />
                  <span className="mt-1 line-clamp-2 text-sm">{entry.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Suggestions />
    </div>
  );
}

/**
 * Five random unread books. The draw is made once the library is loaded and kept until the
 * button redraws it, so a rating or a tag changing in the store doesn't reshuffle the block.
 */
function Suggestions() {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const library = useLibrary();
  const [picks, setPicks] = useState<LibraryEntry[] | null>(null);

  if (!library) return null;
  const drawn = picks ?? pickRandomUnread(library);
  if (!picks) setPicks(drawn);
  // Keep the books' latest state (progress, tags) while the selection itself stays put.
  const byId = new Map(library.map((entry) => [entry.id, entry]));
  const shown = drawn.flatMap((entry) => byId.get(entry.id) ?? []);

  return (
    <section aria-labelledby="home-suggestions" className="mt-6 max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-suggestions" className="text-lg font-medium">
          {t('suggestions.title')}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setPicks(pickRandomUnread(library))}>
          <Shuffle />
          {t('suggestions.shuffle')}
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('suggestions.empty')}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {shown.map((entry) => (
            <li key={entry.id} className="p-3">
              <BookDetails
                entry={entry}
                view="medium"
                onOpen={() => void navigate({ to: '/reader', search: { book: entry.id } })}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
