import { createCanvas } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';

import { applyLanguage } from '../../shared/i18n';
import { assertImageWithinLimit, MAX_IMAGE_PIXELS, readImageSize } from './image-size';

beforeAll(() => applyLanguage('fr'));

/** A PNG header (signature + IHDR) declaring a size, with no pixel data: enough for the header reader. */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

describe('readImageSize', () => {
  it('reads a PNG header', () => {
    expect(readImageSize(pngHeader(30_000, 20_000))).toEqual({ width: 30_000, height: 20_000 });
  });

  it('reads the size of real PNG, JPEG and WebP files', async () => {
    const canvas = createCanvas(123, 45);
    canvas.getContext('2d').fillRect(0, 0, 123, 45);
    const files = [await canvas.encode('png'), await canvas.encode('jpeg'), await canvas.encode('webp')];
    for (const file of files) {
      expect(readImageSize(new Uint8Array(file))).toEqual({ width: 123, height: 45 });
    }
  });

  it('reads a GIF header', () => {
    const bytes = Buffer.alloc(13);
    bytes.write('GIF89a', 0, 'ascii');
    bytes.writeUInt16LE(640, 6);
    bytes.writeUInt16LE(480, 8);
    expect(readImageSize(bytes)).toEqual({ width: 640, height: 480 });
  });

  it('reads a BMP header, top-down or not, and the old core header', () => {
    const info = Buffer.alloc(54);
    info.write('BM', 0, 'ascii');
    info.writeUInt32LE(40, 14);
    info.writeInt32LE(30_000, 18);
    info.writeInt32LE(-20_000, 22);
    expect(readImageSize(info)).toEqual({ width: 30_000, height: 20_000 });

    const core = Buffer.alloc(26);
    core.write('BM', 0, 'ascii');
    core.writeUInt32LE(12, 14);
    core.writeUInt16LE(640, 18);
    core.writeUInt16LE(480, 20);
    expect(readImageSize(core)).toEqual({ width: 640, height: 480 });
    expect(readImageSize(info.subarray(0, 20))).toBeNull();
  });

  it('reads the size of a real AVIF file', async () => {
    const canvas = createCanvas(123, 45);
    canvas.getContext('2d').fillRect(0, 0, 123, 45);
    expect(readImageSize(new Uint8Array(await canvas.encode('avif')))).toEqual({ width: 123, height: 45 });
  });

  it('takes the largest ispe of an AVIF header, and nothing from one without', () => {
    const ispe = (width: number, height: number) => {
      const box = Buffer.alloc(20);
      box.writeUInt32BE(20, 0);
      box.write('ispe', 4, 'ascii');
      box.writeUInt32BE(width, 12);
      box.writeUInt32BE(height, 16);
      return box;
    };
    const ftyp = Buffer.alloc(16);
    ftyp.writeUInt32BE(16, 0);
    ftyp.write('ftypavif', 4, 'ascii');
    expect(readImageSize(Buffer.concat([ftyp, ispe(160, 90), ispe(60_000, 60_000)]))).toEqual({
      width: 60_000,
      height: 60_000,
    });
    expect(readImageSize(ftyp)).toBeNull();
  });

  it('skips JPEG segments before the start-of-frame marker', () => {
    const bytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc2, 0x00, 0x0b, 0x08, 0x75, 0x30, 0x4e, 0x20, 0x03,
    ]);
    expect(readImageSize(bytes)).toEqual({ width: 20_000, height: 30_000 });
  });

  it('returns null for unknown or truncated data', () => {
    expect(readImageSize(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(readImageSize(pngHeader(1, 1).subarray(0, 10))).toBeNull();
    expect(readImageSize(new Uint8Array())).toBeNull();
  });
});

describe('assertImageWithinLimit', () => {
  it('refuses an image above the pixel limit, naming it and its size', () => {
    expect(() => assertImageWithinLimit(pngHeader(30_000, 30_000), '001.png')).toThrow(
      'Image trop grande pour être affichée : 001.png (30000 × 30000 px)',
    );
  });

  it('accepts an image at the limit and data it cannot read', () => {
    const side = Math.floor(Math.sqrt(MAX_IMAGE_PIXELS));
    expect(() => assertImageWithinLimit(pngHeader(side, side), 'a.png')).not.toThrow();
    expect(() => assertImageWithinLimit(new Uint8Array([1, 2, 3]), 'a.avif')).not.toThrow();
  });

  it('refuses a BMP declaring a huge image', () => {
    const bmp = Buffer.alloc(54);
    bmp.write('BM', 0, 'ascii');
    bmp.writeUInt32LE(40, 14);
    bmp.writeInt32LE(30_000, 18);
    bmp.writeInt32LE(30_000, 22);
    expect(() => assertImageWithinLimit(bmp, '001.bmp')).toThrow('Image trop grande');
  });
});
