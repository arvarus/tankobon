import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/** The page shown when the app starts. Blocks will be added here; for now it is an empty view. */
function HomePage() {
  const { t } = useTranslation('home');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
    </div>
  );
}
