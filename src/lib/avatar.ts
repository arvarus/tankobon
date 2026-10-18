/**
 * Profile pictures in the renderer: the crop that makes any picture square, and the conversion of a
 * picked file into the small WebP the main process stores. Only {@link squareCrop} is pure.
 * @module
 */
import { AVATAR_SIZE, MAX_AVATAR_BYTES } from '@/shared/users';

/** The part of a `width` × `height` image that is kept: its largest centred square. */
export function squareCrop(width: number, height: number): { x: number; y: number; size: number } {
  const size = Math.min(width, height);
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}

/** WebP qualities tried in turn until the picture fits in what the main process accepts. */
const QUALITIES = [0.9, 0.75, 0.6, 0.4];

/**
 * Turns the bytes of a picked picture (PNG, JPEG or WebP) into a square WebP of
 * {@link AVATAR_SIZE} px, centred on the picture, small enough for `users:set-avatar`. Rejects when
 * the browser can't decode the file.
 */
export async function shrinkAvatar(bytes: Uint8Array): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas unavailable');
    const { x, y, size } = squareCrop(bitmap.width, bitmap.height);
    context.drawImage(bitmap, x, y, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    for (const quality of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob) throw new Error('encoding failed');
      if (blob.size <= MAX_AVATAR_BYTES) return new Uint8Array(await blob.arrayBuffer());
    }
    throw new Error('picture too large');
  } finally {
    bitmap.close();
  }
}
