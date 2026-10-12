import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { BookDetails, BookRating } from "@/components/book-row";
import { useLibrary } from "@/hooks/use-library";
import { useSettings } from "@/hooks/use-settings";
import { visibleHomeSections } from "@/lib/home-sections";
import { secondChanceEntries } from "@/lib/second-chance";
import type { LibraryEntry } from "@/shared/library";
import type { HomeSection } from "@/shared/settings";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/**
 * The page shown when the app starts: the sections chosen in Paramètres › Accueil, in their order.
 * With the home page turned off it sends to the library instead.
 */
function HomePage() {
  const { t } = useTranslation("home");
  const { settings } = useSettings();
  if (!settings.homeEnabled) return <Navigate to="/library" replace />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      {visibleHomeSections(settings.homeSections).map((id) => {
        const Section = SECTION_VIEWS[id];
        return <Section key={id} />;
      })}
    </div>
  );
}

/** The component drawing each home section. */
const SECTION_VIEWS: Record<HomeSection, () => ReactNode> = {
  secondChance: SecondChanceSection,
};

/** The worst-rated books, to give them a second chance; nothing when no book is rated that low. */
function SecondChanceSection() {
  const { t } = useTranslation("home");
  const library = useLibrary();
  const navigate = useNavigate();
  const entries: LibraryEntry[] = useMemo(
    () => secondChanceEntries(library ?? []),
    [library],
  );
  if (entries.length === 0) return null;

  return (
    <section className="mt-6" aria-labelledby="second-chance-title">
      <h2 id="second-chance-title" className="text-lg font-medium">
        {t("secondChance.title")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {t("secondChance.description")}
      </p>
      <ul className="divide-y rounded-md border">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 p-3">
            <BookDetails
              entry={entry}
              view="medium"
              onOpen={() =>
                void navigate({ to: "/reader", search: { book: entry.id } })
              }
            />
            <BookRating entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
