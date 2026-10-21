/**
 * Image dimensions read from the file header, without decoding the pixels: a few kilobytes of
 * well-compressed PNG can declare tens of thousands of pixels per side, and decoding it allocates
 * four bytes per pixel.
 * @module
 */
import type { ComicPage } from '../../shared/comic';
import { t } from '../../shared/i18n';

/** Largest image decoded, in pixels (100 megapixels, about 400 MB once decoded). */
export const MAX_IMAGE_PIXELS = 100_000_000;

/** Width and height of an image, in pixels. */
export interface ImageSize {
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readPng(bytes: Uint8Array, view: DataView): ImageSize | null {
  // 8-byte signature, then the IHDR chunk: length, "IHDR", width, height.
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== 'IHDR') {
    return null;
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readGif(bytes: Uint8Array, view: DataView): ImageSize | null {
  return bytes.length < 10 ? null : { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function readJpeg(bytes: Uint8Array, view: DataView): ImageSize | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    // Start-of-frame markers (baseline, progressive…) carry the size; C4, C8 and CC don't.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // markers with no payload
      continue;
    }
    offset += 2 + view.getUint16(offset + 2);
  }
  return null;
}

function readWebp(bytes: Uint8Array, view: DataView): ImageSize | null {
  if (bytes.length < 30) {
    return null;
  }
  const format = ascii(bytes, 12, 4);
  if (format === 'VP8X') {
    return {
      width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)),
      height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)),
    };
  }
  if (format === 'VP8L') {
    const bits = view.getUint32(21, true);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (format === 'VP8 ') {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  return null;
}

function readBmp(bytes: Uint8Array, view: DataView): ImageSize | null {
  // 14-byte file header, then the DIB header, whose first field is its own size.
  if (bytes.length < 26) {
    return null;
  }
  if (view.getUint32(14, true) === 12) {
    // BITMAPCOREHEADER: 16-bit unsigned width and height.
    return { width: view.getUint16(18, true), height: view.getUint16(20, true) };
  }
  // BITMAPINFOHEADER and later: signed 32-bit, a negative height meaning rows stored top-down.
  return bytes.length < 26 ? null : { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) };
}

/** How far into an AVIF file the `ispe` boxes are looked for: the `meta` box comes first. */
const AVIF_SCAN_BYTES = 64 * 1024;

function readAvif(bytes: Uint8Array, view: DataView): ImageSize | null {
  // The `ispe` (image spatial extents) properties: box size 20, "ispe", version and flags, then width and
  // height as big-endian 32-bit numbers. A file can hold several (a thumbnail, grid tiles): the largest counts.
  let largest: ImageSize | null = null;
  const end = Math.min(bytes.length, AVIF_SCAN_BYTES) - 15;
  for (let at = 4; at < end; at += 1) {
    if (bytes[at] !== 0x69 || ascii(bytes, at, 4) !== 'ispe' || view.getUint32(at - 4) !== 20) {
      continue;
    }
    const size = { width: view.getUint32(at + 8), height: view.getUint32(at + 12) };
    if (largest === null || size.width * size.height > largest.width * largest.height) {
      largest = size;
    }
  }
  return largest;
}

/** Dimensions declared by a PNG, JPEG, GIF, WebP, BMP or AVIF header, or null for any other (or truncated) data. */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return readPng(bytes, view);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return readJpeg(bytes, view);
  }
  const magic = ascii(bytes, 0, 4);
  if (magic === 'GIF8') {
    return readGif(bytes, view);
  }
  if (magic === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return readWebp(bytes, view);
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return readBmp(bytes, view);
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp' && ['avif', 'avis'].includes(ascii(bytes, 8, 4))) {
    return readAvif(bytes, view);
  }
  return null;
}

/**
 * Throws a translated error when the image declares more than `MAX_IMAGE_PIXELS`. Data in a format
 * whose header isn't read here passes: only an image known to be too large is refused.
 */
export function assertImageWithinLimit(data: Uint8Array, name: string): void {
  const size = readImageSize(data);
  if (size && size.width * size.height > MAX_IMAGE_PIXELS) {
    throw new Error(t('errors:archive.imageTooLarge', { entry: name, width: size.width, height: size.height }));
  }
}

/** `page` itself once checked by `assertImageWithinLimit()`, for the archives' `readPage()`. */
export function checkedPage(page: ComicPage, name: string): ComicPage {
  assertImageWithinLimit(page.data, name);
  return page;
}
