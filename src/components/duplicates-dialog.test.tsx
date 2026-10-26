// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { libraryEntry } from '@/test/fixtures';
import { renderWithTankobon } from '@/test/tankobon';
import { DuplicatesDialog } from './duplicates-dialog';

afterEach(cleanup);

const groups = [[libraryEntry('keep', { title: 'Astérix' }), libraryEntry('copy', { title: 'Astérix' })]];

function open(removeMany: (ids: string[], deleteFiles: boolean) => Promise<unknown>) {
  const onClose = vi.fn();
  renderWithTankobon(<DuplicatesDialog groups={groups} onClose={onClose} />, {
    library: { removeMany: removeMany as never },
    settings: { set: vi.fn(async () => undefined) as never },
  });
  fireEvent.click(screen.getByRole('button', { name: /Retirer 1 fichier/ }));
  return onClose;
}

describe('DuplicatesDialog', () => {
  it('removes the files that are not kept, then closes', async () => {
    const removeMany = vi.fn(async () => ({ removed: 1, filesDeleted: 0, filesFailed: 0 }));
    const onClose = open(removeMany);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(removeMany).toHaveBeenCalledWith(['copy'], false);
  });

  it('stays open and says so when the removal is refused', async () => {
    const onClose = open(vi.fn(async () => Promise.reject(new Error('refused'))));
    expect(await screen.findByText(/n’ont pas pu être retirés/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    // Busy again no more: the user can try again or cancel.
    expect((screen.getByRole('button', { name: /Retirer 1 fichier/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('reports the files that could not go to the trash and stays open', async () => {
    const onClose = open(vi.fn(async () => ({ removed: 1, filesDeleted: 0, filesFailed: 1 })));
    expect(await screen.findByText(/n’a pas pu être mis à la corbeille/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
