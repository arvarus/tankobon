import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** A page within this distance of the viewport (above or below) is fetched. */
const LOAD_MARGIN = '800px 0px';
/**
 * A loaded page farther than this from the viewport is released (its image and `blob:` URL), so the
 * renderer's memory follows what is near the reader instead of growing with every page read. Wider
 * than {@link LOAD_MARGIN}, so a page at the edge doesn't flip between loaded and released.
 */
const KEEP_MARGIN = '3000px 0px';

interface ContinuousPageProps {
  comicId: string;
  index: number;
  onActive: (index: number) => void;
}

export function ContinuousPage({ comicId, index, onActive }: ContinuousPageProps) {
  const { t } = useTranslation('reader');
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // The height a released page had, kept for its placeholder: collapsing it to the generic one would
  // shift everything below, and the pages above the reader's position would move the page under their eyes.
  const [releasedHeight, setReleasedHeight] = useState<number | null>(null);
  const hasImage = useRef(false);

  // Three observers: one fetches the page before it is visible, one releases it once it is far away,
  // and the last tracks which page actually counts as "current" for resuming later: the one crossing
  // the middle of the viewport. A visibility threshold wouldn't do, since a page taller than twice the
  // viewport (a portrait page on a landscape screen) is never 50 % visible.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const loadObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShouldLoad(true);
      },
      { rootMargin: LOAD_MARGIN },
    );
    const keepObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting || !hasImage.current) return;
        hasImage.current = false;
        setReleasedHeight(el.offsetHeight > 0 ? el.offsetHeight : null);
        setShouldLoad(false);
        setUrl(null);
      },
      { rootMargin: KEEP_MARGIN },
    );
    const activeObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onActive(index);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    loadObserver.observe(el);
    keepObserver.observe(el);
    activeObserver.observe(el);
    return () => {
      loadObserver.disconnect();
      keepObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [index, onActive]);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    window.tankobon.comic
      .readPage(comicId, index)
      .then(({ data, mimeType }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([data], { type: mimeType }));
        hasImage.current = true;
        setFailed(false);
        setReleasedHeight(null);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [shouldLoad, comicId, index]);

  return (
    <div ref={ref} className="w-full max-w-full">
      {url ? (
        <img src={url} alt={t('pageAlt', { page: index + 1 })} draggable={false} className="block w-full" />
      ) : (
        <div
          className={releasedHeight === null ? 'flex h-[60vh] w-full items-center justify-center text-neutral-500' : 'flex w-full items-center justify-center text-neutral-500'}
          style={releasedHeight === null ? undefined : { height: releasedHeight }}
        >
          {failed ? <span className="text-sm">{t('pageUnreadable')}</span> : <Loader2 className="size-6 animate-spin" />}
        </div>
      )}
    </div>
  );
}
