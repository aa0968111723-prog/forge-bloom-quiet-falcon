import * as THREE from "three";

/**
 * Small imperative effect pools shared by creatures and skills.
 * Everything is built once per owner and only transforms/opacities change
 * per frame; nothing allocates while a fight is running.
 */

/** A hand-drawn red-pen circle: slightly irregular, with an overlapping tail. */
export function penCircleGeometry(radius: number, width: number, seed = 1) {
  const segs = 72;
  const turns = 1.08;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = t * Math.PI * 2 * turns + seed;
    const wobble = 1 + Math.sin(a * 3 + seed * 2) * 0.012 + Math.sin(a * 7 + seed) * 0.006;
    // Pen pressure: thin at the ends of the stroke.
    const w = width * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.1) * Math.PI));
    const r0 = radius * wobble - w / 2;
    const r1 = radius * wobble + w / 2;
    pos.push(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * r1, 0, Math.sin(a) * r1);
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export type Burst = {
  mesh: THREE.InstancedMesh;
  /** Start a burst at a world position; `count` ≤ capacity. */
  fire: (at: THREE.Vector3, count: number, opts?: { up?: number; spread?: number; spin?: number }) => void;
  update: (dt: number) => void;
  dispose: () => void;
};

/**
 * Paper flakes: instanced quads with simple ballistic motion and spin.
 * Used for hit chips and the defeat confetti.
 */
export function paperBurst(capacity: number, colors: string[], size = 0.12, life = 0.7): Burst {
  const geometry = new THREE.PlaneGeometry(size, size * 1.3);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.frustumCulled = false;
  mesh.count = 0;
  const color = new THREE.Color();
  for (let i = 0; i < capacity; i++) mesh.setColorAt(i, color.set(colors[i % colors.length]));
  const parts = Array.from({ length: capacity }, () => ({
    p: new THREE.Vector3(),
    v: new THREE.Vector3(),
    r: new THREE.Euler(),
    w: new THREE.Vector3(),
    age: life,
  }));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let live = 0;
  return {
    mesh,
    fire(at, count, opts = {}) {
      const up = opts.up ?? 2.4;
      const spread = opts.spread ?? 2.2;
      const spin = opts.spin ?? 9;
      live = Math.min(capacity, count);
      for (let i = 0; i < live; i++) {
        const a = (i / live) * Math.PI * 2 + Math.random() * 0.6;
        const p = parts[i];
        p.p.copy(at);
        p.v.set(Math.cos(a) * spread * (0.5 + Math.random() * 0.6), up * (0.6 + Math.random() * 0.6), Math.sin(a) * spread * (0.5 + Math.random() * 0.6));
        p.r.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        p.w.set((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin);
        p.age = 0;
      }
      mesh.count = live;
    },
    update(dt) {
      if (!live) return;
      let alive = 0;
      for (let i = 0; i < live; i++) {
        const p = parts[i];
        p.age += dt;
        // Paper falls slowly and drifts.
        p.v.y -= 4.2 * dt;
        p.v.multiplyScalar(1 - 1.8 * dt);
        p.p.addScaledVector(p.v, dt);
        p.r.x += p.w.x * dt;
        p.r.y += p.w.y * dt;
        p.r.z += p.w.z * dt;
        const k = Math.max(0, 1 - p.age / life);
        if (k > 0) alive++;
        s.setScalar(k > 0 ? 0.4 + 0.6 * k : 0.0001);
        m.compose(p.p, q.setFromEuler(p.r), s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      material.opacity = alive ? 0.95 : 0;
      if (!alive) {
        live = 0;
        mesh.count = 0;
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
