import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { BookDetails, BookRating } from '@/components/book-row';
import { useLibrary } from '@/hooks/use-library';
import { lowestRated } from '@/lib/second-chance';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/** The page shown when the app starts: a block per section, for now the worst-rated books. */
function HomePage() {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const library = useLibrary();
  const entries = useMemo(() => (library ? lowestRated(library) : []), [library]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <section aria-labelledby="second-chance" className="space-y-3">
        <div>
          <h2 id="second-chance" className="text-lg font-medium">
            {t('secondChance.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('secondChance.description')}</p>
        </div>
        {library && entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('secondChance.empty')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 p-3">
                <BookDetails
                  entry={entry}
                  view="medium"
                  onOpen={() => void navigate({ to: '/reader', search: { book: entry.id } })}
                />
                <BookRating entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
