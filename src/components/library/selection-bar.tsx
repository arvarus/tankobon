import { ListPlus, Pencil, Search, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

/**
 * Above the list: a checkbox ticking every book shown (or none), and, once books are selected,
 * their count and the group actions (add them to a reading list, edit them, look them up one after the other, remove them, clear the selection).
 */
export function SelectionBar({
  selectedCount,
  shownSelected,
  shown,
  onToggleAll,
  onClear,
  onAddToList,
  onEdit,
  onLookup,
  onRemove,
}: {
  selectedCount: number;
  shownSelected: number;
  shown: number;
  onToggleAll: () => void;
  onClear: () => void;
  onAddToList: () => void;
  onEdit: () => void;
  onLookup: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('library');
  const all = shownSelected === shown;
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-2 px-3 text-sm">
      <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
        <input
          type="checkbox"
          checked={all}
          ref={(input) => {
            if (input) input.indeterminate = shownSelected > 0 && !all;
          }}
          onChange={onToggleAll}
          className="size-4"
        />
        {selectedCount === 0 ? t('selectAllShown', { count: shown }) : t('selectedCount', { count: selectedCount })}
      </label>
      {selectedCount > 0 && (
        <>
          <Button variant="outline" size="sm" onClick={onAddToList}>
            <ListPlus />
            {t('addSelectionToList')}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil />
            {t('editSelection')}
          </Button>
          <Button variant="outline" size="sm" onClick={onLookup}>
            <Search />
            {t('lookupSelection')}
          </Button>
          <Button variant="outline" size="sm" onClick={onRemove}>
            <Trash2 />
            {t('removeSelection')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X />
            {t('clearSelection')}
          </Button>
        </>
      )}
    </div>
  );
}
