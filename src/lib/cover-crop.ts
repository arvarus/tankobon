/**
 * Choosing a book's cover in the renderer: the crop that fits any picture to the cover's 2:3
 * proportions (pure, {@link coverSourceRect}) and the conversion of the chosen part into the WebP
 * sent to the main process ({@link cropToCover}).
 * @module
 */

/** Width of the picture sent to `library:set-cover`, in pixels (the main process shrinks it to the thumbnail size). */
export const COVER_OUTPUT_WIDTH = 480;
/** Height of that picture: the cover's proportions are 2:3. */
export const COVER_OUTPUT_HEIGHT = 720;
/** Largest zoom of the crop: the frame can show a 1/{@link MAX_COVER_ZOOM} part of the picture. */
export const MAX_COVER_ZOOM = 4;

/** A rectangle of the source picture, in its own pixels. */
export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * The part of a `width` × `height` picture shown in the 2:3 frame. At zoom 1 the picture covers the frame
 * (its largest 2:3 part); a bigger zoom shows less of it. `panX` and `panY` (0 to 1, clamped) place the
 * visible part inside the room that is left: 0 is the left/top edge, 0.5 the centre, 1 the right/bottom edge.
 */
export function coverSourceRect(width: number, height: number, zoom: number, panX: number, panY: number): SourceRect {
  const clampedZoom = Math.min(MAX_COVER_ZOOM, Math.max(1, zoom));
  const ratio = COVER_OUTPUT_WIDTH / COVER_OUTPUT_HEIGHT;
  // The largest part of the picture with the frame's proportions, divided by the zoom.
  const fullWidth = Math.min(width, height * ratio);
  const sw = fullWidth / clampedZoom;
  const sh = sw / ratio;
  const clampUnit = (value: number) => Math.min(1, Math.max(0, value));
  return {
    sx: clampUnit(panX) * (width - sw),
    sy: clampUnit(panY) * (height - sh),
    sw,
    sh,
  };
}

/** WebP qualities tried in turn until the picture fits in what `library:set-cover` accepts. */
const QUALITIES = [0.9, 0.75, 0.6];

/**
 * Draws `rect` of `source` into a {@link COVER_OUTPUT_WIDTH} × {@link COVER_OUTPUT_HEIGHT} canvas and encodes
 * it as WebP. Rejects when the canvas or the encoding is unavailable.
 */
export async function cropToCover(source: ImageBitmap, rect: SourceRect): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_OUTPUT_WIDTH;
  canvas.height = COVER_OUTPUT_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');
  context.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, COVER_OUTPUT_WIDTH, COVER_OUTPUT_HEIGHT);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITIES[0]));
  if (!blob) throw new Error('encoding failed');
  return new Uint8Array(await blob.arrayBuffer());
}
