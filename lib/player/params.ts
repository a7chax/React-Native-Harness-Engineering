/** The Now Playing screen's validated deep-link parameters. */
export type PlayerParams = {
  trackId: string;
  /** Start position, in whole milliseconds. */
  atMs: number;
  paused: boolean;
  /** Development-only JS-thread busy-wait, in milliseconds. */
  stallMs: number | null;
};

/** Route params as `useLocalSearchParams` returns them. */
export type RawParams = Record<string, string | string[] | undefined>;

export const MAX_STALL_MS = 10_000;

/** Plain unsigned decimals only: no sign, exponent, hex or whitespace. */
const DECIMAL_REGEX = /^\d+(\.\d+)?$/;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Returns the number a plain decimal string spells, or null for anything else. */
const parseDecimal = (value: string | undefined): number | null => {
  if (value === undefined || !DECIMAL_REGEX.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Validates the `track`, `at`, `paused` and `stall` deep-link parameters. Never
 * throws: an unknown track falls back to the first catalog id, and an `at` that
 * is not a number or lies outside the track starts from 0.
 */
export function parsePlayerParams(
  raw: RawParams,
  options: {
    trackIds: readonly string[];
    durationMsFor: (id: string) => number;
    isDev: boolean;
  },
): PlayerParams {
  const requested = first(raw.track);
  const trackId =
    requested !== undefined && options.trackIds.includes(requested)
      ? requested
      : options.trackIds[0];

  const at = parseDecimal(first(raw.at));
  const atMs = at !== null && at <= options.durationMsFor(trackId) ? Math.floor(at) : 0;

  const stall = options.isDev ? parseDecimal(first(raw.stall)) : null;
  const stallMs = stall !== null && stall > 0 ? Math.min(stall, MAX_STALL_MS) : null;

  return { trackId, atMs, paused: first(raw.paused) === '1', stallMs };
}
