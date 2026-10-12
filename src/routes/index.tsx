import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { BookCover } from '@/components/book-cover';
import { useLibrary } from '@/hooks/use-library';
import { recentlyAdded } from '@/lib/recent-books';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/** The page shown when the app starts: a "recently added" block, more blocks will follow. */
function HomePage() {
  const { t } = useTranslation('home');
  const library = useLibrary();
  const recent = useMemo(() => (library ? recentlyAdded(library) : []), [library]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
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
    </div>
  );
}
