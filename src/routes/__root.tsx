import { Outlet, createRootRoute } from '@tanstack/react-router';

import { AchievementToasts } from '@/components/achievement-toasts';
import { ImageScanBar } from '@/components/layout/image-scan-bar';
import { Sidebar } from '@/components/layout/sidebar';
import { UserChooser } from '@/components/user-chooser';
import { UpdateToast } from '@/components/update-toast';
import { useAchievementTracker } from '@/hooks/use-achievements';
import { useFullscreen } from '@/hooks/use-fullscreen';
import { useLaunchFile } from '@/hooks/use-launch-file';
import { useUsers } from '@/hooks/use-users';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  // Fullscreen reading (toggled from the reader) hides the sidebar entirely; the
  // collapsed/expanded preference is untouched and comes back on exit.
  const { fullscreen } = useFullscreen();
  const activeUserId = useUsers()?.activeId;
  // A comic opened from the file explorer.
  useLaunchFile();

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      {!fullscreen && <ImageScanBar />}
      {/* Remounted for each user, so the tracker never counts one user's library for another's achievements. */}
      <AchievementTracker key={activeUserId} />
      <AchievementToasts key={activeUserId} />
      <UpdateToast />
      <UserChooser />
    </div>
  );
}

function AchievementTracker() {
  useAchievementTracker();
  return null;
}
