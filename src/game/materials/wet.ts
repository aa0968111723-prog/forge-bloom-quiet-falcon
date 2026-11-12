import * as THREE from "three";

/**
 * Darken and smooth an untextured colour when it is wet.
 *
 * Library materials mix a grey into a white tint that then multiplies a
 * texture. These court colours are already darker than that grey, so the same
 * mix would lighten them. Scale the colour down instead.
 */
export function wetSurface(color: string, wetness = 0, response = 0.6, roughness = 0.9) {
  const wet = Math.min(1, Math.max(0, wetness)) * response;
  const base = new THREE.Color(color);
  if (wet > 0) base.multiplyScalar(1 - wet * 0.42);
  return {
    color: `#${base.getHexString()}`,
    roughness: Math.max(0.05, roughness - wet * 0.55),
  };
}

/** Relative luminance of an sRGB hex colour, in linear light. */
export function surfaceLuminance(color: string) {
  const { r, g, b } = new THREE.Color(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
