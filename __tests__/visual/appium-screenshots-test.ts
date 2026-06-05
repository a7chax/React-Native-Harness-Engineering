/**
 * Visual regression layer for the Appium E2E suite.
 *
 * Wired into the harness pipeline documented in HARNESS_GUIDE.md and
 * .skills/harness-engineering/SKILL.md:
 *
 *   Appium (WebdriverIO) E2E run  →  `afterTest` hook saves one screenshot
 *     per test (pass or fail) into `automation_test/screenshots/`
 *        →  THIS SUITE diffs each screenshot against a committed baseline
 *           under `__image_snapshots__/`
 *
 * Conventions:
 *   - The Appium runner writes ONE screenshot per test case, named by the
 *     test's full title (see `automation_test/wdio.conf.ts` → `afterTest`).
 *     One stable PNG per test means a stable baseline key here — no flaky
 *     "which intermediate frame" problem the old video-frame pipeline had.
 *   - Screenshots live (git-ignored, regenerated each run) at
 *     `automation_test/screenshots/<test-title>.png`.
 *   - Baselines are committed PNGs under
 *     `__tests__/visual/__image_snapshots__/appium-<test-title>.png`
 *   - On fresh checkouts (no Appium run yet) the suite skips so CI stays
 *     green. Run the Appium suite first (`npm run test:appium`) to populate
 *     screenshots, then this suite engages.
 *
 * Update baselines intentionally with:
 *   npx jest __tests__/visual/appium-screenshots-test.ts -u
 * after reviewing the UI change is intended (same discipline as the
 * existing structural `.snap` files — see SKILL.md "Snapshot update").
 */

import fs from 'node:fs';
import path from 'node:path';

import { ANDROID_STATUS_BAR_PX_DEFAULT, cropTopRows } from '../../lib/visual/frameUtils';

const SHOTS_ROOT = path.resolve(__dirname, '../../automation_test/screenshots');

/** Tolerance for emulator font hinting / sub-pixel drift between runs. */
const FAILURE_THRESHOLD = 0.02; // 2% of pixels may differ
const FAILURE_THRESHOLD_TYPE = 'percent' as const;

/**
 * Per-screenshot override of how many pixels of status bar to crop before
 * diff. Defaults to ANDROID_STATUS_BAR_PX_DEFAULT (Pixel-class emulator) when
 * a screenshot is not listed. Add entries here only when a run targets a
 * different emulator profile (taller bar on tablets, notch skins). Keyed by
 * the screenshot filename without extension (the test-title slug).
 */
const STATUS_BAR_PX_BY_SHOT: Record<string, number> = {};

function statusBarPxFor(shot: string): number {
  return STATUS_BAR_PX_BY_SHOT[shot] ?? ANDROID_STATUS_BAR_PX_DEFAULT;
}

function listShots(): string[] {
  if (!fs.existsSync(SHOTS_ROOT)) return [];
  return fs
    .readdirSync(SHOTS_ROOT)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
}

const shots = listShots();

if (shots.length === 0) {
  // Keep the file as a discoverable suite even when no Appium run has
  // happened yet — fresh-checkout CI stays green, contributors see the
  // shape of the layer in the Jest output.
  describe.skip('Appium screenshots visual regression (no screenshots yet)', () => {
    it('runs after the Appium suite captures screenshots', () => {
      // Intentionally empty — see file header for the harness contract.
    });
  });
} else {
  describe('Appium screenshots visual regression', () => {
    for (const file of shots) {
      const slug = file.replace(/\.png$/i, '');
      const statusBarPx = statusBarPxFor(slug);

      it(`screenshot ${file} matches baseline (status bar ${statusBarPx}px cropped)`, () => {
        const raw = fs.readFileSync(path.join(SHOTS_ROOT, file));
        const masked = cropTopRows(raw, statusBarPx);
        expect(masked).toMatchImageSnapshot({
          customSnapshotIdentifier: `appium-${slug}`,
          failureThreshold: FAILURE_THRESHOLD,
          failureThresholdType: FAILURE_THRESHOLD_TYPE,
        });
      });
    }
  });
}
