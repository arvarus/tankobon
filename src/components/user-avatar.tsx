import { UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import type { UserProfile } from '@/shared/users';

/**
 * A user's round profile picture, or the generic contact image when they have none. The picture's
 * bytes are shown through a `blob:` URL (allowed by the CSP's `img-src`), revoked when it changes.
 */
export function UserAvatar({ user, className }: { user: Pick<UserProfile, 'avatar' | 'avatarType'>; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const { avatar, avatarType } = user;

  useEffect(() => {
    if (!avatar || !avatarType) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(new Blob([avatar as BlobPart], { type: avatarType }));
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [avatar, avatarType]);

  return url ? (
    <img src={url} alt="" className={cn('shrink-0 rounded-full object-cover', className)} />
  ) : (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground', className)}
      aria-hidden="true"
    >
      <UserRound className="size-3/5" />
    </span>
  );
}
