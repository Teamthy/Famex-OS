/**
 * App version comparison.
 *
 * Lives in lib/ rather than inside the route so the test exercises the same
 * function the server runs. A copy in the test file would let the two drift
 * apart silently — which is the exact failure mode this project has been
 * cleaning up all week.
 */

/**
 * True when `version` is older than `minimum`.
 *
 * Compares numerically, segment by segment. A string compare gets this wrong
 * at precisely the wrong moment: "1.10.0" < "1.9.0" is true alphabetically,
 * which would lock out the NEWEST users while letting older ones through.
 *
 * Missing segments count as zero, so "1.0" and "1.0.0" are equal. A malformed
 * segment parses to 0 rather than throwing — an exception here would take down
 * the launch path of every client at once.
 */
export function isOlderThan(version: string, minimum: string): boolean {
  const parse = (value: string) =>
    value
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));

  const a = parse(version);
  const b = parse(minimum);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left < right;
  }
  return false;
}
