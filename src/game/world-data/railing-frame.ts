import * as THREE from "three";

const LOCAL_Z = new THREE.Vector3(0, 0, 1);
const dir = new THREE.Vector3();

/** Place a box whose local +Z runs from `a` to `b`, including the slope. */
export function railingSegmentFrame(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) {
  dir.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const length = Math.max(dir.length(), 0.001);
  dir.multiplyScalar(1 / length);
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    length,
    quaternion: new THREE.Quaternion().setFromUnitVectors(LOCAL_Z, dir),
  };
}
