import { app, net } from 'electron';

import type { LibraryEntry, MetadataUpdate } from '../../shared/library';
import type { MetadataPageResult, MetadataSearchResult } from '../../shared/metadata';
import type { LibraryRepository } from '../db/library-repository';
import type { SettingsRepository } from '../db/settings-repository';
import type { DecoderClient } from '../decoder/decoder-client';
import { writeNfo } from '../services/nfo';
import { fetchMetadataPage, searchMetadata } from '../services/metadata-service';
import type { HttpOptions } from '../services/http-json';
import { handle } from './handle';
import type { NotifyDataChange } from './data-changes';
import { MAX_PATH_LENGTH, args, expectMetadataQuery, expectMetadataUpdate, expectNonEmptyString } from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const METADATA_CHANNELS = {
  search: 'metadata:search',
  fromPage: 'metadata:from-page',
  apply: 'metadata:apply',
} as const;

function httpOptions(): HttpOptions {
  return {
    // Chromium's network stack rather than Node's: it honours the system proxy settings.
    fetch: net.fetch as typeof fetch,
    userAgent: `Tankobon/${app.getVersion()}`,
    timeoutMs: 15_000,
  };
}

export function registerMetadataIpc(
  settingsRepo: SettingsRepository,
  libraryRepo: LibraryRepository,
  decoder: DecoderClient,
  notify: NotifyDataChange,
): void {
  handle(METADATA_CHANNELS.search, args(expectMetadataQuery), (_event, query): Promise<MetadataSearchResult> =>
    searchMetadata(query, settingsRepo.getAll(), httpOptions()),
  );
  handle(
    METADATA_CHANNELS.fromPage,
    args((url) => expectNonEmptyString(url, 'url', MAX_PATH_LENGTH)),
    (_event, url): Promise<MetadataPageResult> => fetchMetadataPage(url, httpOptions()),
  );
  // The lookup dialog's save: the information goes to the library, then to the `.nfo` beside the
  // file, and the cover is made if the book has none yet, so nothing waits for a later scan.
  handle(
    METADATA_CHANNELS.apply,
    args((id) => expectNonEmptyString(id, 'id', MAX_PATH_LENGTH), expectMetadataUpdate),
    async (_event, id, update: MetadataUpdate): Promise<LibraryEntry | null> => {
      const updated = libraryRepo.updateMetadata(id, update);
      if (!updated) return null;
      notify({ scope: 'library', upserted: [updated] });
      await writeNfo(updated);
      await decoder.thumbnail(updated.path).catch(() => null);
      return updated;
    },
  );
}
