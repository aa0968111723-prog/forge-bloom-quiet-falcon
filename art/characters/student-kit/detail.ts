/**
 * Level of detail for one kit build. LOD0 is the hero mesh; LOD1 keeps every
 * silhouette part (hair clumps, tail, jacket opening, cuffs, backpack, turtle)
 * but drops sub-centimetre details and lowers tessellation for the low tier.
 */
export type Detail = 0 | 1;

let current: Detail = 0;

/** Build-scoped: set at the start of a kit build and restored after it. */
export function withDetail<T>(detail: Detail, build: () => T): T {
  const previous = current;
  current = detail;
  try {
    return build();
  } finally {
    current = previous;
  }
}

/** Pick the hero value or the low-tier value. */
export const lod = (hero: number, low: number) => (current === 0 ? hero : low);

/** True while building LOD1. */
export const lowDetail = () => current === 1;
