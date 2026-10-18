import type { StatsRepository } from '../db/stats-repository';
import { handle } from './handle';
import { args, expectInteger, idArg } from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const STATS_CHANNELS = {
  get: 'stats:get',
  addReadingTime: 'stats:add-reading-time',
  history: 'stats:history',
  clearHistory: 'stats:clear-history',
} as const;

/** Longest reading time accepted in one call, in seconds (the reader reports every few minutes at most). */
const MAX_READING_SECONDS = 3_600;

// The statistics page reads the history when it opens and is not part of the data store, so
// recording time needs no `data:changed` notification.
export function registerStatsIpc(repo: StatsRepository): void {
  handle(STATS_CHANNELS.get, args(), () => repo.get());

  handle(STATS_CHANNELS.history, args(), () => repo.history());
  handle(STATS_CHANNELS.clearHistory, args(), () => repo.clearHistory());

  handle(
    STATS_CHANNELS.addReadingTime,
    args(idArg, (seconds) => expectInteger(seconds, 'seconds', 1, MAX_READING_SECONDS)),
    (_event, libraryId, seconds) => repo.addReadingTime(libraryId, seconds),
  );
}
