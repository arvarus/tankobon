import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { BookDetails, BookRating } from '@/components/book-row';
import { useLibrary } from '@/hooks/use-library';
import { secondChanceEntries } from '@/lib/second-chance';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/** The page shown when the app starts: a block per list, for now the worst-rated books. */
function HomePage() {
  const { t } = useTranslation('home');
  const library = useLibrary();
  const navigate = useNavigate();
  const secondChance = useMemo(() => secondChanceEntries(library ?? []), [library]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      {secondChance.length > 0 && (
        <section className="mt-6" aria-labelledby="second-chance-title">
          <h2 id="second-chance-title" className="text-lg font-medium">
            {t('secondChance.title')}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">{t('secondChance.description')}</p>
          <ul className="divide-y rounded-md border">
            {secondChance.map((entry) => (
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
        </section>
      )}
    </div>
  );
}
