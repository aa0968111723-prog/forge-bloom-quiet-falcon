/** Mulberry32. The saved uint32 plus the seed reproduce the same draws. */
export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nextRng(state: number): { state: number; value: number } {
  let next = state | 0;
  next = (next + 0x6d2b79f5) | 0;
  let mixed = Math.imul(next ^ (next >>> 15), 1 | next);
  mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  return { state: next >>> 0, value };
}

export function startRng(seed: string): number {
  const hashed = hashSeed(seed);
  return hashed === 0 ? 0x6d2b79f5 : hashed;
}
