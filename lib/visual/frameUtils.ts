/**
 * Frame preprocessing for the visual regression layer.
 *
 * The Android status bar (clock, battery, signal indicators) drifts
 * every run and would dominate every pixel diff if left in. The harness
 * masks it by cropping the top N rows from both the new frame and the
 * baseline before passing them to `toMatchImageSnapshot`.
 *
 * Crop (not blackout) is the chosen strategy because (a) it shrinks the
 * diff surface area, (b) keeps baseline files smaller, and (c) makes
 * "did the mask take effect" obvious from baseline image dimensions.
 */

import { PNG } from 'pngjs';

/**
 * Default Android status-bar height in pixels for a stock Pixel-class
 * emulator at 1080×1920+ density. Override per-flow in
 * `maestro-frames-test.ts` if a flow runs against a different emulator
 * profile (taller status bar on tablets, notch on certain skins).
 */
export const ANDROID_STATUS_BAR_PX_DEFAULT = 75;

/**
 * Return a new PNG buffer with the top `rows` pixel rows removed.
 * Width and bit depth are preserved; height becomes `height - rows`.
 *
 * @throws if `rows` is negative, non-integer, or >= the image height.
 */
export function cropTopRows(input: Buffer, rows: number): Buffer {
  if (!Number.isInteger(rows) || rows < 0) {
    throw new Error(
      `cropTopRows: rows must be a non-negative integer (got ${rows})`,
    );
  }

  const png = PNG.sync.read(input);

  if (rows === 0) {
    return PNG.sync.write(png);
  }

  if (rows >= png.height) {
    throw new Error(
      `cropTopRows: rows (${rows}) must be less than image height (${png.height})`,
    );
  }

  const out = new PNG({ width: png.width, height: png.height - rows });
  const bytesPerRow = png.width << 2; // RGBA = 4 bytes per pixel
  png.data.copy(out.data, 0, rows * bytesPerRow);
  return PNG.sync.write(out);
}
