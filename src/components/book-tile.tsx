import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { BookCover } from '@/components/book-cover';
import type { LibraryEntry } from '@/shared/library';

/**
 * A book of a home block: its cover and title, linking to the reader. `extra` goes inside the link, under
 * the title (the stars of the favorites); `footer` goes under the link, for what has its own controls (the
 * rating that can be changed in place). It is a list item, for {@link BookCarousel}.
 */
export function BookTile({ entry, extra, footer }: { entry: LibraryEntry; extra?: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation('home');
  return (
    <li className="w-32 shrink-0">
      <Link
        to="/reader"
        search={{ book: entry.id }}
        aria-label={t('openBook', { title: entry.title })}
        className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <BookCover entryId={entry.id} title={entry.title} className="aspect-[2/3] w-full" />
        <span className="mt-1 line-clamp-2 text-sm">{entry.title}</span>
        {extra}
      </Link>
      {footer}
    </li>
  );
}
