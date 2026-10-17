/**
 * Index of the row whose window contains `positionMs`: the last `i` with
 * `times[i] <= positionMs`. Returns -1 before the first row, at or after
 * `endMs`, for empty `times` and for a NaN position. `times` must be sorted.
 */
export function activeLineIndex(
  times: readonly number[],
  positionMs: number,
  endMs: number | null,
): number {
  'worklet';
  // `!(a >= b)` also rejects a NaN position.
  if (times.length === 0 || !(positionMs >= times[0])) return -1;
  if (endMs !== null && positionMs >= endMs) return -1;

  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (times[mid] <= positionMs) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
