import * as THREE from "three";
import { STAND_DECK_H, STAND_RAMP } from "./zones/secondary.ts";

/** Local height of the reviewing ramp. Matches `standDeckLift` around a centered deck. */
export function standRampHeight(x: number, z: number, width: number, depth: number): number {
  const outside = Math.hypot(Math.max(0, Math.abs(x) - width / 2), Math.max(0, Math.abs(z) - depth / 2));
  if (outside <= 0) return STAND_DECK_H;
  if (outside >= STAND_RAMP) return 0;
  return STAND_DECK_H * (1 - outside / STAND_RAMP);
}

/** Skirt around the deck. Cells fully inside the platform are omitted so they do not fight the box. */
export function standRampGeometry(width: number, depth: number): THREE.BufferGeometry {
  const step = 0.8;
  const x0 = -width / 2 - STAND_RAMP;
  const z0 = -depth / 2 - STAND_RAMP;
  const nx = Math.max(2, Math.round((width + STAND_RAMP * 2) / step));
  const nz = Math.max(2, Math.round((depth + STAND_RAMP * 2) / step));
  const xs = Array.from({ length: nx + 1 }, (_, i) => x0 + ((width + STAND_RAMP * 2) * i) / nx);
  const zs = Array.from({ length: nz + 1 }, (_, i) => z0 + ((depth + STAND_RAMP * 2) * i) / nz);
  const outsideOf = (x: number, z: number) =>
    Math.hypot(Math.max(0, Math.abs(x) - width / 2), Math.max(0, Math.abs(z) - depth / 2));
  const positions: number[] = [];
  const indices: number[] = [];
  const vertex = new Map<string, number>();
  const at = (x: number, z: number) => {
    const key = `${x.toFixed(3)}:${z.toFixed(3)}`;
    const found = vertex.get(key);
    if (found !== undefined) return found;
    const id = positions.length / 3;
    positions.push(x, standRampHeight(x, z, width, depth), z);
    vertex.set(key, id);
    return id;
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const corners: [number, number][] = [
        [xs[i], zs[j]],
        [xs[i + 1], zs[j]],
        [xs[i + 1], zs[j + 1]],
        [xs[i], zs[j + 1]],
      ];
      const outside = corners.map(([x, z]) => outsideOf(x, z));
      if (outside.every((value) => value <= 0)) continue;
      if (outside.every((value) => value >= STAND_RAMP)) continue;
      const [a, b, c, d] = corners.map(([x, z]) => at(x, z));
      indices.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
