/**
 * Static airframes beside 海事博物館. Estimated silhouettes, parked parallel
 * to the hull and north of it so the south door stays open.
 */
export const HULL_YAW = 0.16;

export const MUSEUM_EXHIBITS = [
  { id: "museum-jet", kind: "jet", x: 160, z: -270, length: 12, span: 8 },
  { id: "museum-heli", kind: "heli", x: 136, z: -270, length: 8, span: 8 },
] as const;

export type MuseumExhibit = (typeof MUSEUM_EXHIBITS)[number];

/** Axis-aligned footprint of a yawed exhibit. The mesh stays inside it. */
export function exhibitFootprint(item: MuseumExhibit) {
  const c = Math.abs(Math.cos(HULL_YAW));
  const s = Math.abs(Math.sin(HULL_YAW));
  return {
    x: item.x,
    z: item.z,
    w: item.length * c + item.span * s,
    d: item.length * s + item.span * c,
  };
}
