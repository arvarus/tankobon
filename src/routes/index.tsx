import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Star } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { BookCover } from '@/components/book-cover';
import { useLibrary } from '@/hooks/use-library';
import { topRated } from '@/lib/home-favorites';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/** The page shown when the app starts: a selection of the best-rated books to rediscover. */
function HomePage() {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const library = useLibrary();
  const favorites = useMemo(() => topRated(library ?? []), [library]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      {favorites.length > 0 && (
        <section className="mt-6" aria-labelledby="home-favorites">
          <h2 id="home-favorites" className="text-lg font-medium">
            {t('favorites.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('favorites.description')}</p>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {favorites.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-2">
                <button
                  type="button"
                  className="flex flex-col gap-2 text-left"
                  onClick={() => void navigate({ to: '/reader', search: { book: entry.id } })}
                >
                  <BookCover entryId={entry.id} title={entry.title} className="aspect-[2/3] w-full" />
                  <span className="line-clamp-2 text-sm font-medium">{entry.title}</span>
                </button>
                <span className="flex gap-0.5" role="img" aria-label={t('favorites.rating', { rating: entry.rating })}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      className={`size-4 ${value <= entry.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
                      aria-hidden
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
