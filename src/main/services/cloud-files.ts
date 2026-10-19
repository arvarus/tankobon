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

/**
 * True when reading `filePath` would download it from a cloud drive. Only detected on Windows
 * (`attrib` exposes the recall attributes, which Node's `stat` doesn't); false elsewhere, and
 * whenever the check itself fails, so a file is never wrongly held back.
 */
export async function isOnlineOnly(
  filePath: string,
  platform: NodeJS.Platform = process.platform,
  run: AttribRunner = runAttrib,
): Promise<boolean> {
  if (platform !== 'win32') return false;
  try {
    return isOnlineOnlyOutput(await run(filePath), filePath);
  } catch {
    return false;
  }
}
