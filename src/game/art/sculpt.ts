import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
export type V3 = [number, number, number];
/** Bake sculpted, vertex-coloured parts into one draw call. No per-frame allocation. */
export class Sculpt {
  private parts: THREE.BufferGeometry[] = [];
  add(source: THREE.BufferGeometry, color: string, position: V3 = [0,0,0], scale: V3 = [1,1,1], rotation: V3 = [0,0,0]) {
    const g = source.index ? source.toNonIndexed() : source;
    if (g !== source) source.dispose();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
    const colors = new Float32Array(g.attributes.position.count * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < g.attributes.position.count; i++) c.toArray(colors, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    // All primitives use the same attribute layout before merging.
    for (const key of Object.keys(g.attributes)) if (!["position","normal","uv","color"].includes(key)) g.deleteAttribute(key);
    this.parts.push(g); return this;
  }
  box(size: V3, color: string, p: V3, r: V3 = [0,0,0], round = 0.025) {
    return this.add(new RoundedBoxGeometry(...size, 1, Math.min(round, ...size.map(v=>v/3))), color, p, [1,1,1], r);
  }
  ellipsoid(size: V3, color: string, p: V3, r: V3 = [0,0,0]) {
    return this.add(new THREE.SphereGeometry(1, 12, 8), color, p, size, r);
  }
  beam(a: V3, b: V3, radius: number, color: string) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(radius, radius, direction.length(), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), direction.normalize()));
    return this.add(g, color, start.add(end).multiplyScalar(0.5).toArray() as V3);
  }
  mesh(name: string, roughness = 0.76) {
    if (!this.parts.length) throw new Error("Empty sculpt: " + name);
    const g = mergeGeometries(this.parts, false);
    this.parts.forEach(p=>p.dispose()); this.parts = [];
    if (!g) throw new Error("Incompatible sculpt: " + name);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true, roughness}));
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
}
/** Only for exclusively owned procedural models; never dispose shared world textures. */
export function disposeSculpt(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(o=>{
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.LineSegments).isLineSegments) return;
    geometries.add(m.geometry);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) materials.add(mat);
  });
  geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
}

