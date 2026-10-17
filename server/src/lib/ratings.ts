type Distribution = Record<1 | 2 | 3 | 4 | 5, number>;

/**
 * Star histogram consistent with an aggregate (average, count). Products store aggregates rather
 * than every historic rating, so the bars are modelled: weights decay geometrically away from
 * 5 stars, with the decay tuned (binary search) until the mean matches the average.
 */
export function distributionFromAverage(average: number, count: number): Distribution {
  const empty: Distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (count <= 0) return empty;

  const meanFor = (r: number) => {
    const w = [1, 2, 3, 4, 5].map((k) => Math.pow(r, 5 - k));
    const total = w.reduce((a, b) => a + b, 0);
    return w.reduce((s, wk, i) => s + wk * (i + 1), 0) / total;
  };

  // r → 0 puts everything on 5 stars (mean 5); r = 1 is uniform (mean 3).
  let lo = 0.0001;
  let hi = 1;
  const target = Math.min(4.999, Math.max(3, average));
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (meanFor(mid) > target) lo = mid;
    else hi = mid;
  }
  const r = (lo + hi) / 2;
  const weights = [1, 2, 3, 4, 5].map((k) => Math.pow(r, 5 - k));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Largest-remainder rounding so the counts add up exactly.
  const raw = weights.map((w) => (w / totalWeight) * count);
  const floors = raw.map(Math.floor);
  let remaining = count - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (remaining <= 0) break;
    floors[i]!++;
    remaining--;
  }
  return { 1: floors[0]!, 2: floors[1]!, 3: floors[2]!, 4: floors[3]!, 5: floors[4]! };
}
