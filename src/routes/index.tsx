import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Shuffle, Star } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { BookCover } from "@/components/book-cover";
import { BookRating } from "@/components/book-row";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/hooks/use-library";
import { useSettings } from "@/hooks/use-settings";
import { visibleHomeSections } from "@/lib/home-sections";
import { continueReading } from "@/lib/continue-reading";
import { topRated } from "@/lib/home-favorites";
import { pickRandomUnread } from "@/lib/home-picks";
import { recentlyAdded } from "@/lib/recent-books";
import { lowestRated } from "@/lib/second-chance";
import type { LibraryEntry } from "@/shared/library";
import type { HomeSection } from "@/shared/settings";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/**
 * The page shown when the app starts: the blocks chosen in Paramètres › Accueil, in their order.
 * With the home page turned off it sends to the library instead.
 */
function HomePage() {
  const { t } = useTranslation("home");
  const { settings } = useSettings();
  if (!settings.homeEnabled) return <Navigate to="/library" replace />;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      {visibleHomeSections(settings.homeSections).map((id) => {
        const Section = SECTION_VIEWS[id];
        return <Section key={id} />;
      })}
    </div>
  );
}

/** The component drawing each home block. */
const SECTION_VIEWS: Record<HomeSection, () => ReactNode> = {
  continueReading: ContinueReading,
  recentlyAdded: RecentlyAdded,
  favorites: Favorites,
  suggestions: Suggestions,
  secondChance: SecondChance,
};

/** The books started and not finished, to resume; nothing when there are none. */
function ContinueReading() {
  const { t } = useTranslation("home");
  const library = useLibrary();
  const books = library ? continueReading(library) : [];
  return (
    <>
      {books.length > 0 && (
        <section className="mt-6" aria-labelledby="continue-reading">
          <h2 id="continue-reading" className="text-lg font-medium">
            {t("continueReading")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-4">
            {books.map((entry) => (
              <li key={entry.id} className="w-32">
                <Link
                  to="/reader"
                  search={{ book: entry.id }}
                  className="block rounded-md hover:opacity-90"
                >
                  <BookCover
                    entryId={entry.id}
                    title={entry.title}
                    className="aspect-[2/3] w-full"
                  />
                  <p
                    className="mt-1 truncate text-sm font-medium"
                    title={entry.title}
                  >
                    {entry.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("continueReadingPage", {
                      page: entry.currentPage + 1,
                      total: entry.pageCount,
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** The books most recently added to the library. */
function RecentlyAdded() {
  const { t } = useTranslation("home");
  const library = useLibrary();
  const recent = useMemo(
    () => (library ? recentlyAdded(library) : []),
    [library],
  );
  return (
    <>
      <section className="mt-6" aria-labelledby="recently-added">
        <h2 id="recently-added" className="text-lg font-medium">
          {t("recentlyAdded")}
        </h2>
        {library && recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("recentlyAddedEmpty")}
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-4">
            {recent.map((entry) => (
              <li key={entry.id} className="w-32">
                <Link
                  to="/reader"
                  search={{ book: entry.id }}
                  aria-label={t("openBook", { title: entry.title })}
                  className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <BookCover
                    entryId={entry.id}
                    title={entry.title}
                    className="aspect-[2/3] w-full"
                  />
                  <span className="mt-1 line-clamp-2 text-sm">
                    {entry.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** The best-rated books; nothing while none is rated. */
function Favorites() {
  const { t } = useTranslation("home");
  const library = useLibrary();
  const favorites = useMemo(
    () => (library ? topRated(library) : []),
    [library],
  );
  return (
    <>
      {favorites.length > 0 && (
        <section className="mt-6" aria-labelledby="home-favorites">
          <h2 id="home-favorites" className="text-lg font-medium">
            {t("favorites.title")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-4">
            {favorites.map((entry) => (
              <li key={entry.id} className="w-32">
                <Link
                  to="/reader"
                  search={{ book: entry.id }}
                  aria-label={t("openBook", { title: entry.title })}
                  className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <BookCover
                    entryId={entry.id}
                    title={entry.title}
                    className="aspect-[2/3] w-full"
                  />
                  <span className="mt-1 line-clamp-2 text-sm">
                    {entry.title}
                  </span>
                  <span
                    className="mt-0.5 flex gap-0.5"
                    role="img"
                    aria-label={t("favorites.rating", { rating: entry.rating })}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        className={`size-3.5 ${value <= entry.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                        aria-hidden
                      />
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * Five random unread books. The draw is made once the library is loaded and kept until the
 * button redraws it, so a rating or a tag changing in the store doesn't reshuffle the block.
 */
function Suggestions() {
  const { t } = useTranslation("home");
  const library = useLibrary();
  const [picks, setPicks] = useState<LibraryEntry[] | null>(null);

  if (!library) return null;
  const drawn = picks ?? pickRandomUnread(library);
  if (!picks) setPicks(drawn);
  // Keep the books' latest state (progress, tags) while the selection itself stays put.
  const byId = new Map(library.map((entry) => [entry.id, entry]));
  const shown = drawn.flatMap((entry) => byId.get(entry.id) ?? []);

  return (
    <section className="mt-6" aria-labelledby="home-suggestions">
      <div className="flex items-center gap-3">
        <h2 id="home-suggestions" className="text-lg font-medium">
          {t("suggestions.title")}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPicks(pickRandomUnread(library))}
        >
          <Shuffle />
          {t("suggestions.shuffle")}
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("suggestions.empty")}
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-4">
          {shown.map((entry) => (
            <li key={entry.id} className="w-32">
              <Link
                to="/reader"
                search={{ book: entry.id }}
                aria-label={t("openBook", { title: entry.title })}
                className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <BookCover
                  entryId={entry.id}
                  title={entry.title}
                  className="aspect-[2/3] w-full"
                />
                <span className="mt-1 line-clamp-2 text-sm">{entry.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The five lowest-rated books, as covers like the other blocks, with their rating editable in place. */
function SecondChance() {
  const { t } = useTranslation("home");
  const library = useLibrary();
  const entries = useMemo(
    () => (library ? lowestRated(library) : []),
    [library],
  );

  if (!library) return null;
  return (
    <section className="mt-6" aria-labelledby="second-chance">
      <h2 id="second-chance" className="text-lg font-medium">
        {t("secondChance.title")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("secondChance.description")}
      </p>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("secondChance.empty")}
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-4">
          {entries.map((entry) => (
            <li key={entry.id} className="w-32">
              <Link
                to="/reader"
                search={{ book: entry.id }}
                aria-label={t("openBook", { title: entry.title })}
                className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <BookCover
                  entryId={entry.id}
                  title={entry.title}
                  className="aspect-[2/3] w-full"
                />
                <span className="mt-1 line-clamp-2 text-sm">{entry.title}</span>
              </Link>
              <div className="mt-1">
                <BookRating entry={entry} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
