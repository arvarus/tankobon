/**
 * The log of the metadata lookups, to find out why a search finds nothing. Lines go to the main
 * process's standard output (the terminal of `npm start`/`npm run dev`, or the console the packaged
 * app was launched from), prefixed with the source. Never holds an API key: callers log URLs of public
 * pages and search terms only.
 * @module
 */

/** Where the lines go; the tests replace it. */
let sink: (line: string) => void = (line) => console.info(line);

/** Redirects the log (null silences it); returns what to call to restore the previous sink. */
export function setLookupLogSink(next: ((line: string) => void) | null): () => void {
  const previous = sink;
  sink = next ?? (() => undefined);
  return () => {
    sink = previous;
  };
}

/** Writes one line, `[lookup:<source>] <message>`. */
export function lookupLog(source: string, message: string): void {
  sink(`[lookup:${source}] ${message}`);
}
