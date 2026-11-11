/**
 * The eight college skills that are not engineering.
 *
 * Each one is a different shape. They all read the same cast record:
 * a wave travels out to `attackFx.range`, a marker appears on every id in
 * `attackFx.hits` (damage was already applied), then it fades. Skills that
 * restore health or focus also send a pulse back to the player. Nothing here
 * writes combat state. Marks stay under 0.8 m and translucent so enemy
 * telegraphs (render order 3) remain visible.
 */
import * as THREE from "three";
import type { Discipline } from "../../rpg/data";

export const COLLEGE_CASTS = [
  "science",
  "humanities",
  "business",
  "language",
  "education",
  "international",
  "computing",
  "health",
] as const satisfies readonly Discipline[];

export type CollegeCast = (typeof COLLEGE_CASTS)[number];

const LIFE = 0.75;
const WAVE = 0.22;
const MAX_HITS = 8;

const mat = (color: string) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

function ground(mesh: THREE.Mesh) {
  mesh.renderOrder = 2;
  const m = mesh.material as THREE.MeshBasicMaterial;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -6;
  m.polygonOffsetUnits = -6;
  return mesh;
}

/** One group per discipline. Children: travel, impact0..7, back (return pulse). */
export function buildCollegeCasts(detailed: boolean): THREE.Group {
  const root = new THREE.Group();
  root.name = "college-casts";
  const n = detailed ? MAX_HITS : 4;
  const add = (id: CollegeCast, shape: string, travel: THREE.Object3D, impactGeo: THREE.BufferGeometry, color: string, returns: boolean) => {
    const g = new THREE.Group();
    g.name = id;
    g.userData = { shape, returns };
    g.add(travel);
    for (let i = 0; i < MAX_HITS; i++) {
      const mesh = new THREE.Mesh(impactGeo, mat(color));
      mesh.name = `impact${i}`;
      mesh.visible = false;
      mesh.frustumCulled = false;
      if (i >= n) mesh.userData.detail = true;
      g.add(mesh);
    }
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat("#d8ffe4"));
    back.name = "back";
    back.visible = false;
    g.add(back);
    g.visible = false;
    root.add(g);
  };

  const science = new THREE.Group();
  science.name = "travel";
  for (const [name, innerR, outerR] of [
    ["outer", 0.92, 1],
    ["ringB", 0.55, 0.63],
  ] as const) {
    // Spin lives on a parent so the ring's own rotation stays "flat" (x = -90°).
    // Combining that with rotation.y on the same object stands the ring upright.
    const spin = new THREE.Group();
    spin.name = name;
    const mesh = new THREE.Mesh(new THREE.RingGeometry(innerR, outerR, 64), mat("#b9a2fa"));
    mesh.rotation.x = -Math.PI / 2;
    spin.add(mesh);
    science.add(spin);
  }
  add("science", "counter-rings", science, new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), "#b9a2fa", false);
  const ribbon = new THREE.Mesh(wavyRibbon(), mat("#f4b28c"));
  ribbon.name = "travel";
  ribbon.position.y = 0.35;
  add("humanities", "ribbon", ribbon, tear(), "#f4b28c", true);
  const coins = new THREE.Group();
  coins.name = "travel";
  for (let i = 0; i < (detailed ? 8 : 4); i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), mat("#f6ce7a"));
    c.rotation.x = Math.PI / 2;
    c.name = `coin${i}`;
    coins.add(c);
  }
  add("business", "coins", coins, new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12), "#f6ce7a", true);
  const glyphs = new THREE.Group();
  glyphs.name = "travel";
  for (let i = 0; i < 3; i++) {
    const glyph = new THREE.Mesh(glyphShape(), mat("#92deb3"));
    glyph.name = `glyph${i}`;
    glyph.scale.setScalar(4);
    glyphs.add(glyph);
  }
  add("language", "glyphs", glyphs, glyphShape(), "#92deb3", false);
  const board = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat("#f4a8cc"));
  board.rotation.x = -Math.PI / 2;
  board.name = "travel";
  add("education", "board", ground(board), new THREE.TorusGeometry(0.22, 0.035, 6, 16), "#f4a8cc", true);
  const arcs = new THREE.Group();
  arcs.name = "travel";
  for (const side of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 24, Math.PI * 0.85), mat("#9cbde7"));
    arc.rotation.x = -Math.PI / 2;
    arc.name = side < 0 ? "arcL" : "arcR";
    arcs.add(ground(arc));
  }
  add("international", "meeting-arcs", arcs, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), "#9cbde7", true);
  const scan = new THREE.Group();
  scan.name = "travel";
  const cells = detailed ? 12 : 6;
  for (let i = 0; i < cells; i++) {
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), mat("#80dfd0"));
    cell.name = `cell${i}`;
    scan.add(cell);
  }
  const bracket = new THREE.Group();
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.05), mat("#80dfd0"));
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.28), mat("#80dfd0"));
    a.position.set(x * 0.16, 0.05, z * 0.28);
    b.position.set(x * 0.28, 0.05, z * 0.16);
    bracket.add(a, b);
  }
  add("computing", "scan", scan, bracketGeo(bracket), "#80dfd0", false);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat("#b5d792"));
  dome.name = "travel";
  add("health", "dome", dome, new THREE.SphereGeometry(0.12, 8, 6), "#b5d792", true);
  return root;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

function wavyRibbon() {
  const g = new THREE.PlaneGeometry(1, 0.7, 12, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 18) * 0.04);
  g.translate(0.5, 0, 0);
  // Plane width runs along X; yaw faces local -Z, so turn the ribbon forward.
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function tear() {
  const s = new THREE.Shape();
  s.moveTo(-0.12, -0.16);
  s.lineTo(0.1, -0.12);
  s.lineTo(0.04, 0);
  s.lineTo(0.14, 0.08);
  s.lineTo(0, 0.16);
  s.lineTo(-0.1, 0.06);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

function glyphShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.12, -0.16);
  s.lineTo(0.12, -0.16);
  s.lineTo(0.12, -0.08);
  s.lineTo(0.02, -0.08);
  s.lineTo(0.02, 0.16);
  s.lineTo(-0.02, 0.16);
  s.lineTo(-0.02, -0.08);
  s.lineTo(-0.12, -0.08);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

function bracketGeo(template: THREE.Group) {
  const geos: THREE.BufferGeometry[] = [];
  template.updateMatrixWorld(true);
  template.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrix);
    geos.push(g);
  });
  // Merge without the util to keep this module free of extra imports: concatenate non-indexed.
  let count = 0;
  for (const g of geos) count += (g.getAttribute("position") as THREE.BufferAttribute).count;
  const pos = new Float32Array(count * 3);
  let o = 0;
  for (const g of geos) {
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      pos[o++] = p.getX(i);
      pos[o++] = p.getY(i);
      pos[o++] = p.getZ(i);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

export type CastFrame = {
  age: number;
  range: number;
  yaw: number;
  reduced: boolean;
  center: { x: number; y: number; z: number };
  hits: { x: number; y: number; z: number }[];
  player: { x: number; y: number; z: number };
};

/** Pose one discipline group for this frame. Returns whether it should show. */
export function layoutCollegeCast(group: THREE.Object3D, frame: CastFrame) {
  const travel = group.getObjectByName("travel")!;
  const back = group.getObjectByName("back") as THREE.Mesh;
  const fade = 1 - THREE.MathUtils.smoothstep(frame.age, 0.34, LIFE);
  const reach = frame.reduced ? frame.range : frame.range * Math.min(1, Math.pow(frame.age / WAVE, 0.75));
  const shape = group.userData.shape as string;
  group.position.set(frame.center.x, frame.center.y, frame.center.z);
  group.rotation.y = frame.yaw;
  group.updateMatrixWorld(true);
  travel.visible = true;
  if (shape === "counter-rings" || shape === "board" || shape === "meeting-arcs") {
    travel.scale.setScalar(Math.max(0.05, reach));
    // Spin around Y only. Setting Z on a ring that lies flat (rotation.x = -90°) stands it up.
    if (shape === "counter-rings") {
      const spin = frame.reduced ? 0 : frame.age * 2.2;
      travel.getObjectByName("outer")!.rotation.y = spin;
      travel.getObjectByName("ringB")!.rotation.y = -spin * 2;
    }
    if (shape === "meeting-arcs") {
      const close = frame.reduced ? 1 : Math.min(1, frame.age / WAVE);
      travel.getObjectByName("arcL")!.position.x = -(1 - close) * 0.45;
      travel.getObjectByName("arcR")!.position.x = (1 - close) * 0.45;
    }
  } else if (shape === "ribbon") {
    travel.scale.set(1, 1, Math.max(0.05, reach));
    travel.position.set(0, 0.7, 0);
  } else if (shape === "dome") {
    travel.scale.setScalar(Math.max(0.05, reach));
    travel.position.y = 0.02;
  } else if (shape === "glyphs") {
    travel.children.forEach((glyph, i) => {
      const a = frame.age * (frame.reduced ? 0 : 3) + (i * Math.PI * 2) / 3;
      const r = 0.4 + reach * (0.35 + 0.15 * i);
      glyph.position.set(Math.sin(a) * r, 0.7 + i * 0.15, Math.cos(a) * r);
      glyph.lookAt(frame.center.x, glyph.position.y + frame.center.y, frame.center.z);
    });
  } else if (shape === "scan") {
    travel.children.forEach((cell, i) => {
      const a = (i / travel.children.length) * Math.PI * 2;
      const slot = (i + 0.5) / travel.children.length;
      cell.position.set(Math.cos(a) * reach * 0.85, 0.08, Math.sin(a) * reach * 0.85);
      cell.visible = frame.reduced || frame.age / WAVE >= slot * 0.85;
    });
  } else if (shape === "coins") {
    travel.children.forEach((coin, i) => {
      const hit = frame.hits[i % Math.max(1, frame.hits.length)];
      const u = frame.reduced ? 1 : Math.min(1, frame.age / 0.35);
      _a.set(0, 0.8, 0);
      if (hit) group.worldToLocal(_b.set(hit.x, hit.y + 0.8, hit.z));
      else _b.set(Math.sin(i) * reach, 0.6, Math.cos(i) * reach);
      coin.position.lerpVectors(_a, _b, u);
      coin.position.y += Math.sin(u * Math.PI) * 1.6;
    });
  }
  const showImpact = frame.age > (frame.reduced ? 0 : 0.05);
  let i = 0;
  for (const child of group.children) {
    if (!child.name.startsWith("impact")) continue;
    const mesh = child as THREE.Mesh;
    const hit = frame.hits[i];
    const hidden = mesh.userData.detail === true;
    mesh.visible = Boolean(showImpact && hit && !hidden);
    if (mesh.visible && hit) {
      group.worldToLocal(_c.set(hit.x, hit.y, hit.z));
      mesh.position.copy(_c);
      mesh.position.y += group.userData.shape === "counter-rings" ? 0.35 : 0.15;
      const pop = frame.reduced ? 1 : Math.min(1, (frame.age - 0.05) / 0.12);
      mesh.scale.setScalar(0.4 + 0.6 * pop);
    }
    i += 1;
  }
  const returns = group.userData.returns === true && frame.hits.length > 0;
  back.visible = returns && frame.age > 0.12 && frame.age < LIFE;
  if (back.visible) {
    const u = frame.reduced ? 1 : Math.min(1, (frame.age - 0.12) / 0.4);
    _a.set(frame.hits[0].x, frame.hits[0].y + 0.6, frame.hits[0].z).lerp(_b.set(frame.player.x, frame.player.y + 1, frame.player.z), u);
    group.worldToLocal(_a);
    back.position.copy(_a);
  }
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial | undefined;
    if (material && material.opacity !== undefined && mesh.name !== "back") {
      const cap = shape === "dome" || shape === "board" ? 0.22 : 0.55;
      material.opacity = cap * fade;
    }
  });
  if (back.visible) (back.material as THREE.MeshBasicMaterial).opacity = 0.7 * fade;
  return frame.age < LIFE;
}

export const COLLEGE_CAST_LIFE = LIFE;
