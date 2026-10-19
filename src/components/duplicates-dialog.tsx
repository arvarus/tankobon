import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { comicFormat } from '@/shared/comic';
import { formatFileSize } from '@/lib/utils';
import type { LibraryEntry } from '@/shared/library';

/** Marks a group where nothing is removed. */
const KEEP_ALL = '';

/**
 * Lists the books held as several files of the same format (`groups`, from `duplicateGroups()`),
 * and lets the user pick, for each, the file to keep: the others leave the library. A tick box
 * also moves their files to the system trash (off by default). The groups are fixed when the
 * dialog opens, so removing entries doesn't reshuffle what is on screen.
 */
export function DuplicatesDialog({
  groups,
  onClose,
}: {
  groups: LibraryEntry[][];
  onClose: () => void;
}) {
  const { t } = useTranslation(['library', 'common']);
  // The file kept in each group (its first by default), KEEP_ALL to leave the group alone.
  const [kept, setKept] = useState<string[]>(() => groups.map((group) => group[0].id));
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toRemove = groups.flatMap((group, index) =>
    kept[index] === KEEP_ALL ? [] : group.filter((entry) => entry.id !== kept[index]),
  );

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.tankobon.library.removeMany(
        toRemove.map((entry) => entry.id),
        deleteFiles,
      );
      if (result.filesFailed > 0) {
        setError(t('library:duplicatesFilesFailed', { count: result.filesFailed }));
        setBusy(false);
        return;
      }
      onClose();
    } catch {
      setError(t('library:duplicatesFailed'));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={t('library:duplicatesTitle')}
      description={t('library:duplicatesIntro', { count: groups.length })}
    >
      <div className="flex min-h-0 flex-col gap-4 overflow-auto">
        {groups.map((group, index) => (
          <fieldset key={group[0].id} className="flex flex-col gap-1.5 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">
              {group[0].title} · {comicFormat(group[0].path)?.toUpperCase()}
            </legend>
            {group.map((entry) => (
              <label key={entry.id} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={`keep-${index}`}
                  className="mt-1"
                  checked={kept[index] === entry.id}
                  onChange={() => setKept(kept.map((id, i) => (i === index ? entry.id : id)))}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate" title={entry.path}>
                    {entry.path}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('library:duplicateDetails', {
                      pages: entry.pageCount,
                      size: formatFileSize(entry.fileSize),
                    })}
                  </span>
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="radio"
                name={`keep-${index}`}
                checked={kept[index] === KEEP_ALL}
                onChange={() => setKept(kept.map((id, i) => (i === index ? KEEP_ALL : id)))}
              />
              {t('library:duplicatesKeepAll')}
            </label>
          </fieldset>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={deleteFiles} onChange={(event) => setDeleteFiles(event.target.checked)} />
        {t('library:duplicatesDeleteFiles')}
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {t('common:cancel')}
        </Button>
        <Button onClick={apply} disabled={busy || toRemove.length === 0}>
          {t('library:duplicatesApply', { count: toRemove.length })}
        </Button>
      </div>
    </Dialog>
  );
}
