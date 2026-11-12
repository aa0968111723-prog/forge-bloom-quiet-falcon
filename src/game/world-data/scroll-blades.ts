/** Four scroll blades, one character of 樸實剛毅 each. Positions match the plaza pinwheel. */
export const SCROLL_BLADES = [
  { dx: -4.6, dz: 4.6, rot: 2.6, character: "樸" },
  { dx: 4.6, dz: 4.6, rot: 4.2, character: "實" },
  { dx: 4.6, dz: -4.6, rot: 5.8, character: "剛" },
  { dx: -4.6, dz: -4.6, rot: 1.0, character: "毅" },
] as const;

/** A plaque on the inner face of a blade, still inside the existing 3 m box. */
export function scrollPlaque(blade: { dx: number; dz: number }) {
  const len = Math.hypot(blade.dx, blade.dz) || 1;
  const inset = 1.35;
  return {
    x: blade.dx - (blade.dx / len) * inset,
    z: blade.dz - (blade.dz / len) * inset,
    yaw: Math.atan2(-blade.dx, -blade.dz),
  };
}
