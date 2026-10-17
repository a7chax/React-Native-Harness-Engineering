/**
 * Screenshots the visual regression layer does not pixel-diff.
 *
 * The Now Playing screen moves while it plays (highlight, auto-scroll, time
 * label), so its end-of-test screenshots are not stable baselines. Its Appium
 * spec asserts the content instead, and the screenshots are still captured for
 * reading. Keys are screenshot slugs: the `describe` and `it` titles joined
 * and lowercased by `screenshotName()` in `automation_test/wdio.conf.ts`.
 */
export const SKIPPED_SHOT_PREFIXES: readonly string[] = ['player-'];

/** Whether the screenshot with this slug is excluded from the pixel diff. */
export function isSkippedShot(slug: string): boolean {
  return SKIPPED_SHOT_PREFIXES.some((prefix) => slug.startsWith(prefix));
}
