/**
 * PDF support: pages are rasterized on demand with pdf.js and @napi-rs/canvas.
 * @module
 */
import { createCanvas, DOMMatrix, Image, ImageData, Path2D } from '@napi-rs/canvas';
import path from 'node:path';

import type { ComicPage } from '../../shared/comic';
import { t } from '../../shared/i18n';
import { readWholeFile, type ComicArchive } from './comic-archive';
import type { ImageSize } from './image-size';

// pdf.js's rendering code (the `legacy` build, meant for non-browser environments) references
// DOMMatrix/Path2D/ImageData/Image as bare globals, assuming a browser. @napi-rs/canvas is the
// Node-compatible implementation of those APIs pdf.js itself expects to find (it even declares
// it as an optional dependency for exactly this purpose) — it just doesn't install them globally
// on its own, so we do it once here before any PDF gets parsed or rendered.
const globals = globalThis as Record<string, unknown>;
globals.DOMMatrix ??= DOMMatrix;
globals.Path2D ??= Path2D;
globals.ImageData ??= ImageData;
globals.Image ??= Image;

// Kept as a real npm dependency (not bundled by Vite — see vite.decoder.config.mts) so its
// `standard_fonts`/`cmaps` data directories and its `@napi-rs/canvas` native dependency are
// resolved normally from node_modules at runtime, both in dev and once packaged.
type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfjsModule> | undefined;
function getPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= importPdfjs();
  return pdfjsPromise;
}

// pdf.js decides once, when its module is evaluated, whether it runs in Node (`isNodeJS`): it says no
// in an Electron process whose `process.type` isn't `browser`, which is the case of a utilityProcess
// (`utility`). It then takes the browser paths: a worker it can't find ("No GlobalWorkerOptions.workerSrc
// specified") and fetch/DOM canvas for fonts and images, so no PDF opened in the packaged app. The decoder
// is plain Node as far as pdf.js is concerned, so `process.type` is hidden for the duration of the import.
async function importPdfjs(): Promise<PdfjsModule> {
  // `process.type` may be a read-only property, so it is redefined rather than assigned.
  const original = Object.getOwnPropertyDescriptor(process, 'type');
  Object.defineProperty(process, 'type', { value: undefined, configurable: true, writable: true });
  try {
    return await import('pdfjs-dist/legacy/build/pdf.mjs');
  } finally {
    if (original) Object.defineProperty(process, 'type', original);
    else delete (process as { type?: string }).type;
  }
}

type PDFDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;
type PDFDocumentLoadingTask = import('pdfjs-dist').PDFDocumentLoadingTask;

// Renders at a fixed ~200 DPI regardless of the page's physical size: high enough to avoid
// triggering the reader's AI upscaling at normal zoom levels (comparable to a decent comic
// scan), without the memory/CPU cost of going much higher. PDF pages are vector content, so
// unlike CBZ/CBR there's no "native resolution" to defer to.
const RENDER_SCALE = 200 / 72;

/**
 * Ceiling on a rendered page's pixel count (40 megapixels, ~160 MB of RGBA). A tiny PDF can
 * declare a page of thousands of points per side: unbounded, the canvas would take hundreds of
 * MB and seconds of the decoder process per page, and the continuous mode renders several at once.
 */
export const MAX_PAGE_PIXELS = 40_000_000;

/** Rendered pages (PNG bytes) a `PdfArchive` keeps: the current page and its neighbours, plus a little history. */
const PAGE_CACHE_SIZE = 5;

/**
 * The scale to render a page of `width` × `height` points at: `RENDER_SCALE`, lowered when the
 * result would exceed `MAX_PAGE_PIXELS`.
 */
export function pageRenderScale(width: number, height: number): number {
  const area = width * height;
  if (!(area > 0)) return RENDER_SCALE;
  return Math.min(RENDER_SCALE, Math.sqrt(MAX_PAGE_PIXELS / area));
}

// `require` (a plain CJS global here, not `createRequire(import.meta.url)`): Vite bundles this
// module into decoder-worker.cjs as CommonJS, where Rollup rewrites `import.meta.url` to `{}.url`
// (`undefined`) — the same reason cbr-archive.ts reads its wasm file via `__dirname`, not a URL.
//
// pdf.js validates these two options with `val.endsWith('/')` and rejects anything else, so the
// trailing separator has to be a forward slash even on Windows (where `path.sep` is `\`). It
// then just hands the concatenated string to `fs.readFile`, which accepts forward slashes on
// Windows too — so normalizing the whole path to `/` is safe.
function pdfjsAssetDir(name: string): string {
  const dir = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), name);
  return dir.replaceAll(path.sep, '/') + '/';
}

/** A PDF, each page rendered to PNG at `200 DPI when read. `fileCount` always equals the page count. */
export class PdfArchive implements ComicArchive {
  readonly fileCount: number;
  /** Renders by page index, least recently used first (a Map iterates in insertion order). */
  private readonly rendered = new Map<number, Promise<ComicPage>>();
  private closing = false;

  private constructor(
    readonly path: string,
    readonly pages: readonly string[],
    private readonly doc: PDFDocumentProxy,
    private readonly loadingTask: PDFDocumentLoadingTask,
  ) {
    this.fileCount = pages.length;
  }

  /** Loads and parses the document; throws when it has no page. */
  static async open(filePath: string): Promise<PdfArchive> {
    const pdfjs = await getPdfjs();
    const data = new Uint8Array(await readWholeFile(filePath));
    const loadingTask = pdfjs.getDocument({
      data,
      standardFontDataUrl: pdfjsAssetDir('standard_fonts'),
      cMapUrl: pdfjsAssetDir('cmaps'),
      cMapPacked: true,
    });
    const doc = await loadingTask.promise;
    if (doc.numPages === 0) {
      await loadingTask.destroy();
      throw new Error(t('errors:archive.noPages', { path: filePath }));
    }
    const pages = Array.from({ length: doc.numPages }, (_, i) => `page-${i + 1}`);
    return new PdfArchive(filePath, pages, doc, loadingTask);
  }

  /**
   * Renders page `index` (0-based) to PNG; throws a `RangeError` when out of range. Rendered pages
   * are kept (`PAGE_CACHE_SIZE` most recent) and the next and previous pages are rendered in the
   * background, so turning a page usually finds it ready.
   */
  async readPage(index: number): Promise<ComicPage> {
    if (index < 0 || index >= this.pages.length) {
      throw new RangeError(t('errors:archive.pageOutOfRange', { index, last: this.pages.length - 1 }));
    }
    const result = await this.cachedRender(index);
    this.prefetch(index + 1);
    this.prefetch(index - 1);
    return result;
  }

  /** The render of page `index`, from the cache or started now; concurrent calls share one render. */
  private cachedRender(index: number): Promise<ComicPage> {
    const cached = this.rendered.get(index);
    if (cached) {
      // Re-insert to mark it as the most recently used.
      this.rendered.delete(index);
      this.rendered.set(index, cached);
      return cached;
    }
    const render = this.render(index);
    this.rendered.set(index, render);
    // A failed render isn't kept: the next read retries it.
    render.catch(() => {
      if (this.rendered.get(index) === render) this.rendered.delete(index);
    });
    while (this.rendered.size > PAGE_CACHE_SIZE) {
      const oldest = this.rendered.keys().next().value as number;
      this.rendered.delete(oldest);
    }
    return render;
  }

  /** Renders page `index` in the background, if it exists and isn't cached yet; errors are ignored. */
  private prefetch(index: number): void {
    if (this.closing || index < 0 || index >= this.pages.length || this.rendered.has(index)) return;
    this.cachedRender(index).catch(() => undefined);
  }

  private async render(index: number): Promise<ComicPage> {
    const page = await this.doc.getPage(index + 1);
    try {
      const { width, height } = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: pageRenderScale(width, height) });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      // `canvas`/`canvasContext` are typed for the DOM Canvas API; @napi-rs/canvas is a
      // Node-native implementation of that same API (pdf.js's own optional dependency for it).
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
      return { data: new Uint8Array(canvas.toBuffer('image/png')), mimeType: 'image/png' };
    } finally {
      page.cleanup();
    }
  }

  /** Size in pixels page `index` is rendered at, from its box, without rendering it. */
  async pageSize(index: number): Promise<ImageSize | null> {
    if (index < 0 || index >= this.pages.length) {
      return null;
    }
    const page = await this.doc.getPage(index + 1);
    try {
      const { width, height } = page.getViewport({ scale: 1 });
      const scale = pageRenderScale(width, height);
      return { width: Math.ceil(width * scale), height: Math.ceil(height * scale) };
    } finally {
      page.cleanup();
    }
  }

  /** Destroys the pdf.js document. */
  async close(): Promise<void> {
    this.closing = true;
    this.rendered.clear();
    await this.loadingTask.destroy();
  }
}
