import { PNG } from 'pngjs';

import { cropTopRows } from '../../lib/visual/frameUtils';

/** Build a PNG buffer where each row's RGBA is provided by `fill(y)`. */
function buildPng(
  width: number,
  height: number,
  fill: (y: number) => [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const [r, g, b, a] = fill(y);
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

describe('cropTopRows', () => {
  it('strips the top N rows and preserves width', () => {
    // Top 3 rows red, bottom 5 rows green.
    const input = buildPng(4, 8, (y) =>
      y < 3 ? [255, 0, 0, 255] : [0, 255, 0, 255],
    );

    const cropped = PNG.sync.read(cropTopRows(input, 3));

    expect(cropped.width).toBe(4);
    expect(cropped.height).toBe(5);
    // Every pixel in the cropped output should be green.
    for (let i = 0; i < cropped.data.length; i += 4) {
      expect([
        cropped.data[i],
        cropped.data[i + 1],
        cropped.data[i + 2],
        cropped.data[i + 3],
      ]).toEqual([0, 255, 0, 255]);
    }
  });

  it('is a no-op when rows = 0', () => {
    const input = buildPng(2, 2, () => [10, 20, 30, 255]);
    const result = PNG.sync.read(cropTopRows(input, 0));
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });

  it('throws when rows >= image height (would produce empty image)', () => {
    const input = buildPng(2, 2, () => [10, 20, 30, 255]);
    expect(() => cropTopRows(input, 2)).toThrow(/height/i);
    expect(() => cropTopRows(input, 5)).toThrow(/height/i);
  });

  it('rejects non-integer or negative rows', () => {
    const input = buildPng(2, 2, () => [10, 20, 30, 255]);
    expect(() => cropTopRows(input, -1)).toThrow(/non-negative integer/i);
    expect(() => cropTopRows(input, 1.5)).toThrow(/non-negative integer/i);
  });
});
