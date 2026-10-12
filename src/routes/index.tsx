import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Shuffle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BookDetails } from '@/components/book-row';
import { Button } from '@/components/ui/button';
import { useLibrary } from '@/hooks/use-library';
import { pickRandomUnread } from '@/lib/home-picks';
import type { LibraryEntry } from '@/shared/library';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/** The page shown when the app starts: a random selection of unread books, then the blocks to come. */
function HomePage() {
  const { t } = useTranslation('home');

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
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
    <section aria-labelledby="home-suggestions" className="max-w-3xl space-y-3">
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
