/**
 * Verifies the `toMatchImageSnapshot` matcher is wired into Jest via
 * `jest.setup.ts` so the harness's ffmpeg frames can be diffed against
 * committed baselines (see HARNESS_GUIDE.md → Layer 6: Visual Regression).
 *
 * Fixtures are synthesized deterministically with `pngjs` — no binary
 * fixtures are checked in. Only committed baselines under
 * `__image_snapshots__/` form the regression contract.
 *
 * Two assertions cover the integration:
 *   1. matcher is registered and matches a known baseline (the smoke test
 *      that would have thrown `toMatchImageSnapshot is not a function`
 *      had `jest.setup.ts` not been loaded by jest-expo)
 *   2. the underlying pixel-diff engine actually detects differences
 *      (run against `pixelmatch` directly to avoid polluting Jest's
 *      snapshot counters with an intentional negative case)
 */

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/** Build a deterministic solid-color PNG buffer for fixture use. */
function solidPng(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = rgba[0];
      png.data[idx + 1] = rgba[1];
      png.data[idx + 2] = rgba[2];
      png.data[idx + 3] = rgba[3];
    }
  }
  return PNG.sync.write(png);
}

/** Return the raw RGBA pixel buffer for a synthesized PNG (for pixelmatch). */
function solidRgba(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = rgba[0];
      png.data[idx + 1] = rgba[1];
      png.data[idx + 2] = rgba[2];
      png.data[idx + 3] = rgba[3];
    }
  }
  return png.data;
}

describe('jest-image-snapshot matcher integration', () => {
  it('matches a known baseline (red 16x16)', () => {
    const image = solidPng(16, 16, [255, 0, 0, 255]);
    expect(image).toMatchImageSnapshot({
      customSnapshotIdentifier: 'harness-fixture-red-16',
    });
  });

  it('detects pixel differences via the underlying diff engine', () => {
    const a = solidRgba(16, 16, [0, 200, 0, 255]);
    const b = solidRgba(16, 16, [255, 0, 200, 255]);
    const differingPixels = pixelmatch(a, b, null, 16, 16, { threshold: 0 });
    expect(differingPixels).toBe(16 * 16);
  });
});
