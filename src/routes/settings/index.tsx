import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/settings` has no screen of its own — it lands on the first section. */
export const Route = createFileRoute('/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/home' });
  },
});
