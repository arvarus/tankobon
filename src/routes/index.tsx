import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { BookCover } from '@/components/book-cover';
import { useLibrary } from '@/hooks/use-library';
import { continueReading } from '@/lib/continue-reading';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/** The page shown when the app starts: a "continue reading" block, more blocks will follow. */
function HomePage() {
  const { t } = useTranslation('home');
  const library = useLibrary();
  const books = library ? continueReading(library) : [];

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
    </div>
  );
}
