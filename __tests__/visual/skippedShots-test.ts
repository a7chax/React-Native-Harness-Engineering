import fs from 'node:fs';
import path from 'node:path';

import { isSkippedShot } from '../../lib/visual/skippedShots';

const BASELINES = path.resolve(__dirname, '__image_snapshots__');

describe('isSkippedShot', () => {
  it('skips the Now Playing screenshots', () => {
    expect(isSkippedShot('player-pauses-at-a-position-and-shows-the-matching-line')).toBe(true);
    expect(isSkippedShot('player-')).toBe(true);
  });

  it('keeps every auth-flow screenshot that has a committed baseline', () => {
    const slugs = fs
      .readdirSync(BASELINES)
      .filter((file) => file.startsWith('appium-') && file.endsWith('.png'))
      .map((file) => file.replace(/^appium-/, '').replace(/\.png$/, ''));

    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.filter(isSkippedShot)).toEqual([]);
  });

  it('does not match a prefix in the middle of a slug', () => {
    expect(isSkippedShot('home-player-like-title')).toBe(false);
  });
});
