/**
 * Visual regression layer for Maestro flows.
 *
 * Wired into the harness pipeline documented in HARNESS_GUIDE.md and
 * .skills/harness-engineering/SKILL.md:
 *
 *   adb screenrecord  →  Maestro flow  →  ffmpeg frame extraction
 *      →  THIS SUITE diffs each extracted frame against a committed
 *         baseline under `__image_snapshots__/`
 *
 * Conventions:
 *   - Each flow gets its own directory:    `.maestro/recordings/frames/<flow>/`
 *   - Place ONLY action-boundary frames there (the frame right after each
 *     `tapOn` / `inputText` / assertion). Diffing every `fps=1` frame
 *     produces flaky runs because timing of intermediate frames drifts
 *     between runs even on the same device. The harness skill picks the
 *     "perfect moment" frames using the Maestro log; we diff those.
 *   - Baselines are committed PNGs under
 *     `__tests__/visual/__image_snapshots__/maestro-<flow>-<frame>.png`
 *   - On fresh checkouts (no extracted frames yet) the suite skips so
 *     CI stays green. The harness skill's auto-flow extracts frames
 *     before running tests, so on a real run this suite engages.
 *
 * Update baselines intentionally with:
 *   npx jest __tests__/visual/maestro-frames-test.ts -u
 * after reviewing the UI change is intended (same discipline as the
 * existing structural `.snap` files — see SKILL.md "Snapshot update").
 */

import fs from 'node:fs';
import path from 'node:path';

import { ANDROID_STATUS_BAR_PX_DEFAULT, cropTopRows } from '../../lib/visual/frameUtils';

const FRAMES_ROOT = path.resolve(__dirname, '../../.maestro/recordings/frames');

/** Tolerance for emulator font hinting / sub-pixel drift between runs. */
const FAILURE_THRESHOLD = 0.02; // 2% of pixels may differ
const FAILURE_THRESHOLD_TYPE = 'percent' as const;

/**
 * Per-flow override of how many pixels of status bar to crop before diff.
 * Defaults to ANDROID_STATUS_BAR_PX_DEFAULT (Pixel-class emulator) when
 * a flow is not listed. Add entries here only when a flow runs against
 * a different emulator profile (taller bar on tablets, notch skins).
 */
const STATUS_BAR_PX_BY_FLOW: Record<string, number> = {};

function statusBarPxFor(flow: string): number {
  return STATUS_BAR_PX_BY_FLOW[flow] ?? ANDROID_STATUS_BAR_PX_DEFAULT;
}

function listFlows(): string[] {
  if (!fs.existsSync(FRAMES_ROOT)) return [];
  return fs
    .readdirSync(FRAMES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function listFrames(flow: string): string[] {
  const dir = path.join(FRAMES_ROOT, flow);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
}

const flows = listFlows();

if (flows.length === 0) {
  // Keep the file as a discoverable suite even when no harness run has
  // happened yet — fresh-checkout CI stays green, contributors see the
  // shape of the layer in the Jest output.
  describe.skip('Maestro frames visual regression (no extracted frames yet)', () => {
    it('runs after the harness extracts frames via ffmpeg', () => {
      // Intentionally empty — see file header for the harness contract.
    });
  });
} else {
  for (const flow of flows) {
    describe(`Maestro flow: ${flow}`, () => {
      const frames = listFrames(flow);

      if (frames.length === 0) {
        it.skip('has no PNG frames yet', () => undefined);
        return;
      }

      const statusBarPx = statusBarPxFor(flow);

      for (const file of frames) {
        it(`frame ${file} matches baseline (status bar ${statusBarPx}px cropped)`, () => {
          const raw = fs.readFileSync(path.join(FRAMES_ROOT, flow, file));
          const masked = cropTopRows(raw, statusBarPx);
          expect(masked).toMatchImageSnapshot({
            customSnapshotIdentifier: `maestro-${flow}-${file.replace(/\.png$/i, '')}`,
            failureThreshold: FAILURE_THRESHOLD,
            failureThresholdType: FAILURE_THRESHOLD_TYPE,
          });
        });
      }
    });
  }
}
