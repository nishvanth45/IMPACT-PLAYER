/**
 * Deterministic Seeded PRNG (Mulberry32 + FNV-1a 32-bit string hash).
 * One instance per matchSeed ensures exact reproducibility across full matches
 * and exact mid-match save/restore via getState() / restore().
 */

export interface SeededRng {
  /** Returns a deterministic float in [0, 1). */
  next: () => number;
  /** Returns the current 32-bit internal PRNG state for exact serialization. */
  getState: () => number;
  /** Original seed used to initialize this stream. */
  readonly seed: string | number;
}

export function hashSeedToUint32(seed: string | number): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    const u = seed >>> 0;
    return u === 0 ? 0x9e3779b9 : u;
  }
  const str = String(seed);
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash === 0 ? 0x9e3779b9 : hash;
}

export function createSeededRng(
  seed: string | number = 1,
  initialState?: number
): SeededRng {
  let state =
    typeof initialState === 'number' && Number.isFinite(initialState)
      ? initialState >>> 0
      : hashSeedToUint32(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed,
    next,
    getState: () => state >>> 0,
  };
}
