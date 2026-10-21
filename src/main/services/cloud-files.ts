/**
 * Detects files that are only a placeholder of a cloud drive (OneDrive "Files On-Demand"): reading
 * one makes the drive download it, so background work must leave it alone. Opening a book on
 * purpose still reads it, and that is what triggers the download.
 * @module
 */
import { execFile } from 'node:child_process';

/** Runs `attrib` on a file and gives its output; injected by the tests. */
export type AttribRunner = (filePath: string) => Promise<string>;

const runAttrib: AttribRunner = (filePath) =>
  new Promise((resolve, reject) => {
    execFile('attrib', [filePath], { windowsHide: true, timeout: 5000 }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    );
  });

/**
 * Whether `attrib`'s output for a file says it is online-only. The attribute flags come first on
 * the line, before the path: `U` is "unpinned" (the content is in the cloud, not on disk) and `O`
 * is "offline".
 */
export function isOnlineOnlyOutput(output: string, filePath: string): boolean {
  const line = output.split(/\r?\n/).find((candidate) => candidate.trimEnd().endsWith(filePath));
  if (!line) return false;
  const flags = line.slice(0, line.lastIndexOf(filePath)).trim().toUpperCase();
  return flags.includes('U') || flags.includes('O');
}

/** How long an answer is reused, in milliseconds: a library page asks twice per cover, again when scrolled back to. */
export const ONLINE_ONLY_TTL_MS = 30_000;
const ONLINE_ONLY_CACHE_SIZE = 2000;

/**
 * `compute` remembered for `ttlMs` per key (the last `max` keys), so a burst of identical questions
 * starts one process. Pure apart from `now`, which the tests move.
 */
export function withTtlCache<T>(
  compute: (key: string) => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
  max = ONLINE_ONLY_CACHE_SIZE,
): (key: string) => Promise<T> {
  const answers = new Map<string, { at: number; value: Promise<T> }>();
  return (key) => {
    const known = answers.get(key);
    if (known && now() - known.at < ttlMs) return known.value;
    const value = compute(key);
    answers.delete(key);
    answers.set(key, { at: now(), value });
    // A Map iterates in insertion order: the first key is the oldest.
    if (answers.size > max) answers.delete(answers.keys().next().value as string);
    return value;
  };
}

async function check(filePath: string, run: AttribRunner): Promise<boolean> {
  try {
    return isOnlineOnlyOutput(await run(filePath), filePath);
  } catch {
    return false;
  }
}

const checkWithAttrib = withTtlCache((filePath) => check(filePath, runAttrib), ONLINE_ONLY_TTL_MS);

/**
 * True when reading `filePath` would download it from a cloud drive. Only detected on Windows
 * (`attrib` exposes the recall attributes, which Node's `stat` doesn't); false elsewhere, and
 * whenever the check itself fails, so a file is never wrongly held back. The real `attrib` answers are
 * reused for {@link ONLINE_ONLY_TTL_MS} (one process per file instead of one per cover request); a
 * `run` given by a test is never cached.
 */
export async function isOnlineOnly(
  filePath: string,
  platform: NodeJS.Platform = process.platform,
  run?: AttribRunner,
): Promise<boolean> {
  if (platform !== 'win32') return false;
  return run ? check(filePath, run) : checkWithAttrib(filePath);
}
