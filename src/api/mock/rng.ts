// Small deterministic pseudo-random helpers so mock data stays stable across
// reloads (no backend yet to persist state), instead of using Math.random().

export function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  // Warm-up: this LCG's very first output is nearly LINEAR in `seed` for
  // small seed deltas (seed vs. seed+1 differ by only ~7.8e-6 in their first
  // draw) - which matters a lot here, because most callers derive `seed`
  // from hashStringToSeed() on a string that ends in a slowly-incrementing
  // counter, most commonly an hour offset (e.g. weather.ts keys every
  // observation by `${siteId}-${date}-${hour}`). Without this warm-up, two
  // consecutive hours would produce nearly-identical first-random-output
  // sequences, so anything keyed directly off that first draw (a rain
  // on/off decision, a "is this hour severe" flag, ...) would barely change
  // hour to hour - it would take many hours before the LCG's own drift
  // finally crossed whatever threshold decided it, instead of genuinely
  // reshuffling every hour the way simulated/demo data should. A handful of
  // throwaway iterations fully mixes the state before any caller sees a
  // value, at negligible cost.
  for (let i = 0; i < 4; i += 1) {
    state = (state * 16807) % 2147483647;
  }
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function hashStringToSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export function randomInRange(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

export function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length) % items.length];
}
