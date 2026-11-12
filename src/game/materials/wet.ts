import * as THREE from "three";

/** Same grey the material library mixes in when a surface is wet. */
const WET_TINT = new THREE.Color("#7d8288");

/**
 * Darken and smooth an untextured colour the same way the library materials do.
 * `response` is how absorbent the surface is, 0..1.
 */
export function wetSurface(color: string, wetness = 0, response = 0.6, roughness = 0.9) {
  const wet = Math.min(1, Math.max(0, wetness)) * response;
  const base = new THREE.Color(color);
  if (wet > 0) base.lerp(WET_TINT, wet * 0.45);
  return {
    color: `#${base.getHexString()}`,
    roughness: Math.max(0.05, roughness - wet * 0.55),
  };
}
