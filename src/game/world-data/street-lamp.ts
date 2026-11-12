/**
 * Street-lamp head used by the KayKit stand-in.
 *
 * The file's position accessor runs from x -0.239 to 0.030 and y 0 to 0.960,
 * so the arm points toward -X and the head sits near the top. These offsets
 * are that model's local proportions, not a measured campus lamp.
 */
export const STREET_LAMP_SCALE = 4.7;

export const STREET_LAMP_HEAD = { x: -0.2, y: 0.86, z: 0 } as const;

export function streetLampEmissive(lampsOn: boolean) {
  return lampsOn
    ? { color: "#fff6e0", emissive: "#ffe1a8", emissiveIntensity: 1.6 }
    : { color: "#e8e4d8", emissive: "#000000", emissiveIntensity: 0 };
}

/** World position of the lamp head after yaw. Yaw 0 leaves the arm on -X. */
export function streetLampHead(
  x: number,
  z: number,
  rotationY: number,
  ground: number,
  scale = STREET_LAMP_SCALE,
) {
  const lx = STREET_LAMP_HEAD.x * scale;
  const lz = STREET_LAMP_HEAD.z * scale;
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return {
    x: x + lx * c + lz * s,
    y: ground + STREET_LAMP_HEAD.y * scale,
    z: z - lx * s + lz * c,
  };
}
