import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useReducedArtMotion } from "../../art/motion";
import { quality } from "../../quality";
import { useGame } from "../../store";
import { terrainHeight } from "../../world";
import { DEPARTMENTS, DISCIPLINES } from "../../rpg/data";
import { useRpg } from "../../rpg/store";
import { paperBurst } from "./combat-vfx";

/**
 * 工學院 · 結構脈衝 (engineering skill), drawn from the real cast record.
 *
 *   ready     the cooldown (`skillUntil`) elapses with focus ≥ 22 → blueprint ping
 *   release   `attackFx.at` changes → blueprint grid at the caster's feet
 *   travel    a truss wavefront sweeps out to exactly `attackFx.range`
 *   impact    at t = 0, an I-beam slams up under every id in `attackFx.hits`
 *             (the store already applied damage and the 2 m knockback)
 *   dissipate girders sink, lattice and grid fade
 *
 * Kept below 0.7 m and translucent so enemies, their ground warnings and the
 * HUD stay readable. Low tier halves the truss and drops sparks; reduced
 * motion shows the full range at once with no expansion, bounce or sparks.
 */
const CYAN = new THREE.Color("#75d3e8");
const STEEL = new THREE.Color("#cfeef5");
const WAVE = 0.2;
const LIFE = 0.7;
const MAX_HITS = 10;

function trussPanel(width: number, height: number) {
  const bar = (len: number, thick: number, x: number, y: number, rot: number) => {
    const g = new THREE.BoxGeometry(len, thick, thick);
    g.rotateZ(rot);
    g.translate(x, y, 0);
    return g;
  };
  const w = width;
  const h = height;
  const d = Math.hypot(w, h);
  const parts = [
    bar(w, 0.035, 0, 0.02, 0),
    bar(w, 0.035, 0, h, 0),
    bar(h, 0.03, -w / 2, h / 2, Math.PI / 2),
    bar(d, 0.025, 0, h / 2, Math.atan2(h, w)),
  ];
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

function iBeam(height: number) {
  const s = new THREE.Shape();
  const w = 0.32;
  const t = 0.06;
  const web = 0.07;
  s.moveTo(-w / 2, -w / 2);
  s.lineTo(w / 2, -w / 2);
  s.lineTo(w / 2, -w / 2 + t);
  s.lineTo(web / 2, -w / 2 + t);
  s.lineTo(web / 2, w / 2 - t);
  s.lineTo(w / 2, w / 2 - t);
  s.lineTo(w / 2, w / 2);
  s.lineTo(-w / 2, w / 2);
  s.lineTo(-w / 2, w / 2 - t);
  s.lineTo(-web / 2, w / 2 - t);
  s.lineTo(-web / 2, -w / 2 + t);
  s.lineTo(-w / 2, -w / 2 + t);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

const gridMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uColor: { value: CYAN.clone() }, uOpacity: { value: 0 }, uRadius: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vXY;
      void main() {
        vXY = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uRadius;
      varying vec2 vXY;
      void main() {
        vec2 p = vXY * uRadius;
        float r = length(vXY);
        vec2 cell = abs(fract(p / 0.5) - 0.5);
        float grid = 1.0 - smoothstep(0.0, 0.06, min(cell.x, cell.y));
        float major = 1.0 - smoothstep(0.0, 0.03, min(abs(p.x), abs(p.y)) / uRadius);
        float rim = smoothstep(0.9, 0.96, r) * (1.0 - smoothstep(0.98, 1.0, r));
        float a = (grid * 0.45 + major * 0.6 + rim) * (1.0 - smoothstep(0.98, 1.0, r));
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
  });

export function StructuralPulse() {
  const reduced = useReducedArtMotion();
  const low = quality().tier === "low";
  const segments = low ? 16 : 32;

  const parts = useMemo(() => {
    const truss = new THREE.InstancedMesh(
      trussPanel(1, 0.55),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      segments,
    );
    const front = new THREE.Mesh(
      new THREE.RingGeometry(0.975, 1, 96),
      new THREE.MeshBasicMaterial({ color: STEEL, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    );
    front.rotation.x = -Math.PI / 2;
    const grid = new THREE.Mesh(new THREE.CircleGeometry(1, 48), gridMaterial());
    grid.rotation.x = -Math.PI / 2;
    const ping = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1, 4, 1, Math.PI / 4),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    );
    ping.rotation.x = -Math.PI / 2;
    const beams = new THREE.InstancedMesh(
      iBeam(1.4),
      new THREE.MeshBasicMaterial({ color: STEEL, transparent: true, depthWrite: false, toneMapped: false }),
      MAX_HITS,
    );
    const chevrons = new THREE.InstancedMesh(
      (() => {
        const s = new THREE.Shape();
        s.moveTo(-0.35, 0);
        s.lineTo(0, 0.38);
        s.lineTo(0.35, 0);
        s.lineTo(0.22, 0);
        s.lineTo(0, 0.22);
        s.lineTo(-0.22, 0);
        s.closePath();
        const g = new THREE.ShapeGeometry(s);
        g.rotateX(-Math.PI / 2);
        return g;
      })(),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      MAX_HITS,
    );
    const sparks = paperBurst(low ? 0 : 24, ["#bff3ff", "#75d3e8", "#ffffff"], 0.05, 0.45);
    for (const m of [truss, front, grid, ping, beams, chevrons, sparks.mesh]) {
      m.renderOrder = 2;
      m.frustumCulled = false;
      m.visible = false;
    }
    // Ground-hugging parts sit above the raised paving and kerbs (≈ +0.15 m).
    for (const m of [front, grid, ping, chevrons]) {
      const mat = m.material as THREE.Material;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -6;
      mat.polygonOffsetUnits = -6;
    }
    return { truss, front, grid, ping, beams, chevrons, sparks };
  }, [segments, low]);
  useEffect(
    () => () => {
      for (const m of [parts.truss, parts.front, parts.grid, parts.ping, parts.beams, parts.chevrons]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      parts.sparks.dispose();
    },
    [parts],
  );

  const state = useMemo(
    () => ({
      castAt: useRpg.getState().attackFx?.at ?? -1,
      age: Infinity,
      center: new THREE.Vector3(),
      range: 12,
      hits: [] as { x: number; z: number; dx: number; dz: number }[],
      wasReady: true,
      pingAge: Infinity,
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      p: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.08);
    const rpg = useRpg.getState();
    const discipline = DEPARTMENTS.find((d) => d.id === rpg.departmentId)?.discipline;
    const mine = discipline === "engineering";
    const fx = rpg.attackFx;
    const st = state;

    if (mine && fx && fx.skill && fx.at !== st.castAt) {
      st.castAt = fx.at;
      st.age = 0;
      st.range = fx.range;
      st.center.set(fx.x, terrainHeight(fx.x, fx.z), fx.z);
      st.hits = fx.hits
        .map((id) => rpg.enemies.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .slice(0, MAX_HITS)
        .map((e) => {
          const d = Math.max(0.1, Math.hypot(e.x - fx.x, e.z - fx.z));
          return { x: e.x, z: e.z, dx: (e.x - fx.x) / d, dz: (e.z - fx.z) / d };
        });
      if (!reduced && !low) {
        for (const h of st.hits) parts.sparks.fire(st.p.set(h.x, terrainHeight(h.x, h.z) + 0.6, h.z), 8, { up: 3, spread: 2.6, spin: 14 });
      }
    } else if (fx && fx.at !== st.castAt) {
      st.castAt = fx.at;
    }
    st.age += dt;
    parts.sparks.update(dt);

    // Ready ping when the real cooldown has elapsed and focus allows a cast.
    const ready = mine && rpg.clock >= rpg.skillUntil && rpg.focus >= 22 && !rpg.interiorId;
    if (ready && !st.wasReady) st.pingAge = 0;
    st.wasReady = ready;
    st.pingAge += dt;
    const pinging = st.pingAge < 0.55;
    parts.ping.visible = pinging && mine;
    if (parts.ping.visible) {
      const g = useGame.getState();
      const t = st.pingAge / 0.55;
      parts.ping.position.set(g.playerX, terrainHeight(g.playerX, g.playerZ) + 0.16, g.playerZ);
      parts.ping.scale.setScalar(reduced ? 1 : 0.6 + t * 0.8);
      (parts.ping.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
    }

    const active = mine && st.age < LIFE && !rpg.interiorId;
    for (const m of [parts.truss, parts.front, parts.grid, parts.beams, parts.chevrons]) m.visible = active;
    parts.sparks.mesh.visible = active || st.age < 0.5;
    if (!active) return;

    const t = st.age;
    const fade = 1 - THREE.MathUtils.smoothstep(t, 0.3, LIFE);
    const reach = reduced ? st.range : st.range * Math.min(1, Math.pow(t / WAVE, 0.7));
    const y = st.center.y;

    // Release: blueprint grid under the caster.
    parts.grid.position.set(st.center.x, y + 0.15, st.center.z);
    const gridR = reduced ? 1.8 : 0.6 + 1.2 * Math.min(1, t / 0.1);
    parts.grid.scale.setScalar(gridR);
    const gm = parts.grid.material as THREE.ShaderMaterial;
    gm.uniforms.uRadius.value = gridR;
    gm.uniforms.uOpacity.value = 0.85 * fade;

    // Travel: wavefront ring and upright truss panels at the true range.
    parts.front.position.set(st.center.x, y + 0.17, st.center.z);
    parts.front.scale.setScalar(Math.max(0.1, reach));
    (parts.front.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
    const rise = reduced ? 1 : Math.min(1, t / 0.08);
    const sink = reduced ? 1 : 1 - THREE.MathUtils.smoothstep(t, 0.35, LIFE);
    const chord = (2 * Math.PI * Math.max(reach, 0.5)) / segments;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      st.p.set(st.center.x + Math.cos(a) * reach, y + 0.1, st.center.z + Math.sin(a) * reach);
      st.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -a - Math.PI / 2);
      st.s.set(chord * 0.92, Math.max(0.01, rise * sink), 1);
      st.m.compose(st.p, st.q, st.s);
      parts.truss.setMatrixAt(i, st.m);
    }
    parts.truss.instanceMatrix.needsUpdate = true;
    (parts.truss.material as THREE.MeshBasicMaterial).opacity = 0.55 * fade;

    // Impact: girders under every enemy the store says was hit, from t = 0.
    parts.beams.count = st.hits.length;
    parts.chevrons.count = st.hits.length;
    const pop = reduced ? 1 : t < 0.06 ? t / 0.06 : 1 + Math.sin(Math.min(1, (t - 0.06) / 0.12) * Math.PI) * 0.12;
    st.hits.forEach((h, i) => {
      const gy = terrainHeight(h.x, h.z);
      // The girder punches up on the caster's side of the enemy and leans
      // along the real knockback, so it reads as the shove that moved it.
      const bx = h.x - h.dx * 0.75;
      const bz = h.z - h.dz * 0.75;
      st.p.set(bx, terrainHeight(bx, bz) + 0.05, bz);
      st.q.setFromAxisAngle(st.s.set(h.dz, 0, -h.dx).normalize(), 0.42);
      st.s.set(1, Math.max(0.01, pop * sink * 0.85), 1);
      st.m.compose(st.p, st.q, st.s);
      parts.beams.setMatrixAt(i, st.m);
      // Chevron pointing along the real knockback (away from the caster).
      st.p.set(h.x + h.dx * 0.9, gy + 0.18, h.z + h.dz * 0.9);
      st.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(h.dx, h.dz));
      st.s.setScalar(1);
      st.m.compose(st.p, st.q, st.s);
      parts.chevrons.setMatrixAt(i, st.m);
    });
    parts.beams.instanceMatrix.needsUpdate = true;
    parts.chevrons.instanceMatrix.needsUpdate = true;
    (parts.beams.material as THREE.MeshBasicMaterial).opacity = 0.8 * fade;
    (parts.chevrons.material as THREE.MeshBasicMaterial).opacity = 0.85 * fade;
  });

  return (
    <>
      <primitive object={parts.grid} />
      <primitive object={parts.front} />
      <primitive object={parts.truss} />
      <primitive object={parts.beams} />
      <primitive object={parts.chevrons} />
      <primitive object={parts.ping} />
      <primitive object={parts.sparks.mesh} />
    </>
  );
}

/** Disciplines whose skill is drawn by a dedicated effect instead of the shared families. */
export const DEDICATED_SKILL_VFX: Partial<Record<keyof typeof DISCIPLINES, true>> = {
  engineering: true,
  science: true,
  humanities: true,
  business: true,
  language: true,
  education: true,
  international: true,
  computing: true,
  health: true,
};
