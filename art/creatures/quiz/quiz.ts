/**
 * 突擊小考 — a living exam sheet.
 *
 * Silhouette: a tall curled sheet with a folded dog-ear horn, accordion-paper
 * arms (pencil in the right, a crumpled fist in the left), a torn fringe at
 * the bottom and three mini-quizzes orbiting it. The print on the sheet is
 * the face: answer-bubble eyes, red-ink brows, a torn mouth, a header band,
 * question rows and a red score circle.
 *
 * One skinned mesh. The sheet is weighted across body → mid → top bones so
 * it really curls back during the windup and whips forward on the strike.
 * Units metres, faces +Z, origin on the ground under the sheet.
 */
import * as THREE from "three";
import { PartBuilder, smoothstep, type V3 } from "../../shared/builder.ts";
import { sweep } from "../../shared/loft.ts";
import { Raster, hex, mixColor, pfbm, shade } from "../../shared/raster.ts";

export const QUIZ = {
  id: "creature.quiz",
  version: 1,
  atlasSize: 512,
  /** Sheet size and the hover height of its bottom edge. */
  sheet: { width: 0.84, height: 1.12, thickness: 0.016, hover: 0.34 },
  palette: {
    paper: "#f5ecd6",
    paperBack: "#e6dcc3",
    ink: "#26243a",
    red: "#c8414b",
    graphite: "#3b3a40",
    pencil: "#f2c14e",
    pencilDark: "#d39d2b",
    wood: "#e9c99a",
    eraser: "#ee9aa8",
    ferrule: "#c9c4b6",
  },
  bones: [
    { name: "root", parent: null, offset: [0, 0, 0] },
    { name: "body", parent: "root", offset: [0, 0.34, 0] },
    { name: "mid", parent: "body", offset: [0, 0.42, 0] },
    { name: "top", parent: "mid", offset: [0, 0.36, 0] },
    { name: "dogEar", parent: "top", offset: [0.27, 0.27, 0.0] },
    { name: "armL", parent: "mid", offset: [0.42, 0.06, 0] },
    { name: "armR", parent: "mid", offset: [-0.42, 0.06, 0] },
    { name: "orbit", parent: "body", offset: [0, 0.56, 0] },
  ],
  triangleBudget: 6000,
} as const;

type BoneName = (typeof QUIZ.bones)[number]["name"];
const NAMES = QUIZ.bones.map((b) => b.name) as BoneName[];
const S = QUIZ.atlasSize;
const C = S / 4;
const cell = (x: number, y: number, w = 1, h = 1) => ({ x: x * C, y: y * C, w: w * C, h: h * C });
export const QUIZ_CELLS = {
  front: cell(0, 0, 2, 2),
  back: cell(2, 0),
  paper: cell(3, 0),
  pencil: cell(2, 1),
  wood: cell(3, 1),
  eraser: cell(0, 2),
  ferrule: cell(1, 2),
  graphite: cell(2, 2),
  red: cell(3, 2),
} as const;

function rig() {
  const bones = {} as Record<BoneName, THREE.Bone>;
  const ordered: THREE.Bone[] = [];
  for (const def of QUIZ.bones) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bone.position.set(...(def.offset as unknown as V3));
    bones[def.name] = bone;
    ordered.push(bone);
    if (def.parent) bones[def.parent as BoneName].add(bone);
  }
  bones.root.updateMatrixWorld(true);
  return { bones, skeleton: new THREE.Skeleton(ordered), at: (n: BoneName) => new THREE.Vector3().setFromMatrixPosition(bones[n].matrixWorld) };
}

/** Curled sheet with thickness and a torn bottom fringe. */
function sheetGeometry(front: boolean) {
  const { width, height, thickness, hover } = QUIZ.sheet;
  const cols = 14;
  const rows = 20;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const v = r / rows;
      const x = (u - 0.5) * width;
      // Torn fringe: the bottom row zig-zags.
      const tear = r === 0 ? (c % 2 ? 0.045 : 0) : 0;
      const y = hover + v * height + tear;
      // A page caught in the wind: curved across, a gentle S along its height.
      const z = Math.cos((u - 0.5) * Math.PI) * 0.09 - 0.06 + Math.sin(v * Math.PI * 1.3) * 0.035 + (front ? thickness / 2 : -thickness / 2);
      pos.push(x, y, z);
      uv.push(front ? u : 1 - u, v);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * (cols + 1) + c;
      const j = i + cols + 1;
      if (front) idx.push(i, i + 1, j, i + 1, j + 1, j);
      else idx.push(i, j, i + 1, i + 1, j, j + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Thin strip closing the sheet's edges so it reads as card, not a plane. */
function sheetEdges() {
  const { width, height, thickness, hover } = QUIZ.sheet;
  const zAt = (u: number, v: number) => Math.cos((u - 0.5) * Math.PI) * 0.09 - 0.06 + Math.sin(v * Math.PI * 1.3) * 0.035;
  const pos: number[] = [];
  // Both windings: the strip is 16 mm wide and must read from either side.
  const quad = (a: V3, b: V3, c: V3, d: V3) => pos.push(...a, ...b, ...c, ...b, ...d, ...c, ...a, ...c, ...b, ...b, ...c, ...d);
  const n = 20;
  for (const side of [0, 1]) {
    for (let i = 0; i < n; i++) {
      const v0 = i / n;
      const v1 = (i + 1) / n;
      const x = (side - 0.5) * width;
      const p = (v: number, s: number): V3 => [x, hover + v * height, zAt(side, v) + s * thickness / 2];
      quad(p(v0, 1), p(v1, 1), p(v0, -1), p(v1, -1));
    }
  }
  for (let i = 0; i < 14; i++) {
    const u0 = i / 14;
    const u1 = (i + 1) / 14;
    const p = (u: number, s: number): V3 => [(u - 0.5) * width, hover + height, zAt(u, 1) + s * thickness / 2];
    quad(p(u0, 1), p(u1, 1), p(u0, -1), p(u1, -1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildQuiz() {
  const r = rig();
  const b = new PartBuilder(S);
  const idx = (n: BoneName) => NAMES.indexOf(n);
  const { hover, height } = QUIZ.sheet;
  const yMid = hover + 0.42;
  const yTop = hover + 0.78;
  // Sheet weights: body → mid → top by height, softly blended.
  const sheetSkin = (p: THREE.Vector3): [number, number][] => {
    const toMid = smoothstep(yMid - 0.22, yMid + 0.12, p.y);
    const toTop = smoothstep(yTop - 0.16, yTop + 0.16, p.y);
    return [
      [idx("body"), 1 - toMid],
      [idx("mid"), toMid * (1 - toTop)],
      [idx("top"), toMid * toTop],
    ];
  };
  b.add(sheetGeometry(true), { name: "sheet-front", color: "#ffffff", tile: QUIZ_CELLS.front, skin: sheetSkin });
  b.add(sheetGeometry(false), { name: "sheet-back", color: "#ffffff", tile: QUIZ_CELLS.back, skin: sheetSkin });
  b.add(sheetEdges(), { name: "sheet-edge", color: "#d8cdb2", tile: QUIZ_CELLS.paper, skin: sheetSkin });

  // Dog-ear: the top-right corner folded forward into a horn.
  const ear = r.at("dogEar");
  const fold = new THREE.BufferGeometry();
  fold.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        ear.x - 0.17, ear.y - 0.02, 0.06, ear.x + 0.13, ear.y - 0.04, 0.05, ear.x + 0.02, ear.y + 0.2, 0.13,
        ear.x - 0.17, ear.y - 0.02, 0.045, ear.x + 0.02, ear.y + 0.2, 0.115, ear.x + 0.13, ear.y - 0.04, 0.035,
      ],
      3,
    ),
  );
  fold.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 0, 0, 0.5, 1, 1, 0], 2));
  fold.computeVertexNormals();
  b.add(fold, { name: "dog-ear", color: "#f1e8d2", tile: QUIZ_CELLS.paper, skin: idx("dogEar") });

  // Accordion-folded paper arms.
  for (const side of [1, -1] as const) {
    const bone = side > 0 ? "armL" : "armR";
    const s = r.at(bone);
    const pts: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      pts.push([s.x + side * (0.03 + i * 0.055), s.y - i * 0.035 + (i % 2 ? 0.025 : -0.025), 0.04 + i * 0.012]);
    }
    const arm = sweep(pts, { width: () => 0.045, thickness: () => 0.006, outward: [0, 0, 1], segments: 18, around: 6 });
    b.add(arm.geometry, { name: "paper-arm", color: "#f6eedb", tile: QUIZ_CELLS.paper, skin: idx(bone) });
    const hand = pts[pts.length - 1];
    if (side > 0) {
      // Crumpled paper fist.
      const fist = new THREE.IcosahedronGeometry(0.06, 1);
      const p = fist.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 0.82 + 0.3 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
      }
      fist.computeVertexNormals();
      fist.translate(hand[0] + 0.03, hand[1], hand[2]);
      b.add(fist, { name: "paper-fist", color: "#ffffff", tile: QUIZ_CELLS.paper, skin: idx(bone) });
    } else {
      addPencil(b, new THREE.Vector3(hand[0] - 0.02, hand[1] + 0.02, hand[2] + 0.02), idx(bone));
    }
  }

  // Three orbiting mini quizzes.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const page = new THREE.PlaneGeometry(0.16, 0.21, 2, 3);
    const p = page.attributes.position;
    for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(p.getX(k) * 18) * 0.012);
    page.computeVertexNormals();
    page.rotateY(a + Math.PI / 2);
    page.rotateZ(0.25);
    const o = r.at("orbit");
    page.translate(o.x + Math.cos(a) * 0.62, o.y + Math.sin(a * 2) * 0.12, o.z + Math.sin(a) * 0.62);
    b.add(page, { name: "mini-quiz", color: "#ffffff", tile: QUIZ_CELLS.front, skin: idx("orbit") });
    const pageBack = page.clone();
    const idxs = pageBack.index!.array as Uint16Array;
    for (let k = 0; k < idxs.length; k += 3) [idxs[k + 1], idxs[k + 2]] = [idxs[k + 2], idxs[k + 1]];
    pageBack.computeVertexNormals();
    b.add(pageBack, { name: "mini-quiz-back", color: "#ffffff", tile: QUIZ_CELLS.back, skin: idx("orbit") });
  }

  const geometry = b.build();
  const material = new THREE.MeshStandardMaterial({ name: "quiz-atlas", vertexColors: true, roughness: 0.86, side: THREE.FrontSide });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "quiz";
  mesh.add(r.bones.root);
  mesh.bind(r.skeleton);
  const scene = new THREE.Group();
  scene.name = "creature-quiz";
  scene.add(mesh);
  scene.userData = { artId: QUIZ.id, artVersion: QUIZ.version, sheetTop: hover + height };
  return { scene, mesh, clips: quizClips(), atlasPng: paintQuizAtlas().toPNG(), parts: b.parts, triangles: b.triangleCount, bones: NAMES };
}

function addPencil(b: PartBuilder, grip: THREE.Vector3, bone: number) {
  // Held point-down and forward; ~32 cm so it reads at gameplay distance.
  const dir = new THREE.Vector3(0.15, -0.55, 0.82).normalize();
  const place = (g: THREE.BufferGeometry, along: number) => {
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(grip.x + dir.x * along, grip.y + dir.y * along, grip.z + dir.z * along);
    return g;
  };
  b.add(place(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 6, 1), 0.02), { name: "pencil", color: "#ffffff", tile: QUIZ_CELLS.pencil, skin: bone });
  b.add(place(new THREE.CylinderGeometry(0.0225, 0.0225, 0.035, 8, 1), -0.105), { name: "ferrule", color: "#ffffff", tile: QUIZ_CELLS.ferrule, skin: bone });
  b.add(place(new THREE.CylinderGeometry(0.021, 0.021, 0.04, 8, 1), -0.14), { name: "eraser", color: "#ffffff", tile: QUIZ_CELLS.eraser, skin: bone });
  const cone = new THREE.ConeGeometry(0.022, 0.07, 6, 1);
  cone.rotateX(Math.PI);
  b.add(place(cone, 0.165), { name: "pencil-tip", color: "#ffffff", tile: QUIZ_CELLS.wood, skin: bone });
  const lead = new THREE.ConeGeometry(0.0075, 0.025, 6, 1);
  lead.rotateX(Math.PI);
  b.add(place(lead, 0.2), { name: "pencil-lead", color: "#ffffff", tile: QUIZ_CELLS.graphite, skin: bone });
}

/** Pose-keyed node clips. Windup is scrubbed by real progress at runtime. */
function quizClips() {
  const FPS = 30;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  type Key = { t: number; pose: Partial<Record<BoneName, [number, number, number]>>; bodyY?: number; scale?: number };
  const ease = (x: number) => x * x * (3 - 2 * x);
  const clip = (name: string, duration: number, keys: Key[], loop = false) => {
    const n = Math.max(2, Math.round(duration * FPS));
    const times = Array.from({ length: n + 1 }, (_, i) => (duration * i) / n);
    const bones = new Set<BoneName>();
    keys.forEach((k) => Object.keys(k.pose).forEach((b) => bones.add(b as BoneName)));
    const at = (t: number) => {
      let i = 0;
      while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
      const a = keys[i];
      const b2 = keys[i + 1];
      return { a, b: b2, u: ease(Math.min(1, Math.max(0, (t - a.t) / (b2.t - a.t || 1)))) };
    };
    const tracks: THREE.KeyframeTrack[] = [];
    for (const bone of bones) {
      const values: number[] = [];
      let prev: THREE.Quaternion | null = null;
      for (const t of times) {
        const { a, b: b2, u } = at(t);
        const ea = a.pose[bone] ?? [0, 0, 0];
        const eb = b2.pose[bone] ?? [0, 0, 0];
        e.set(ea[0] + (eb[0] - ea[0]) * u, ea[1] + (eb[1] - ea[1]) * u, ea[2] + (eb[2] - ea[2]) * u);
        q.setFromEuler(e);
        if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        values.push(q.x, q.y, q.z, q.w);
        prev = q.clone();
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
    }
    const bodyY = (k: Key) => k.bodyY ?? 0;
    const scale = (k: Key) => k.scale ?? 1;
    tracks.push(
      new THREE.VectorKeyframeTrack(
        "body.position",
        times,
        times.flatMap((t) => {
          const { a, b: b2, u } = at(t);
          return [0, QUIZ.sheet.hover + bodyY(a) + (bodyY(b2) - bodyY(a)) * u, 0];
        }),
      ),
    );
    if (keys.some((k) => k.scale !== undefined)) {
      tracks.push(
        new THREE.VectorKeyframeTrack(
          "body.scale",
          times,
          times.flatMap((t) => {
            const { a, b: b2, u } = at(t);
            const s = scale(a) + (scale(b2) - scale(a)) * u;
            return [s, s, s];
          }),
        ),
      );
    }
    void loop;
    return new THREE.AnimationClip(name, duration, tracks);
  };

  const sway = (t: number, amp: number): Key["pose"] => ({
    body: [0, 0, Math.sin(t) * amp],
    mid: [Math.sin(t + 1) * amp * 0.8, 0, 0],
    top: [Math.sin(t + 2) * amp * 1.2, 0, 0],
    armL: [0, 0, 0.3 + Math.sin(t * 2) * 0.18],
    armR: [0, 0, -0.3 - Math.sin(t * 2 + 1) * 0.18],
    dogEar: [Math.sin(t * 2) * 0.25, 0, 0],
  });
  const loopKeys = (period: number, amp: number, lean: number, bob: number): Key[] =>
    Array.from({ length: 9 }, (_, i) => {
      const t = (i / 8) * Math.PI * 2;
      const pose = sway(t, amp);
      pose.body = [lean, 0, pose.body![2]];
      return { t: (period * i) / 8, pose, bodyY: Math.sin(t) * bob };
    });

  return [
    clip("idle", 2.4, loopKeys(2.4, 0.06, 0, 0.04), true),
    clip("chase", 0.6, loopKeys(0.6, 0.1, 0.32, 0.05).map((k) => ({ ...k, pose: { ...k.pose, armL: [0.6, 0, 0.5], armR: [0.6, 0, -0.5] } })), true),
    clip("windup", 1.0, [
      { t: 0, pose: {} },
      { t: 0.35, pose: { body: [-0.12, 0, 0], mid: [-0.2, 0, 0], top: [-0.25, 0, 0], armR: [-1.6, 0, -0.6], armL: [-0.4, 0, 0.5], dogEar: [-0.5, 0, 0] }, bodyY: 0.05 },
      { t: 0.85, pose: { body: [-0.24, 0, 0], mid: [-0.36, 0, 0], top: [-0.5, 0, 0], armR: [-2.5, 0, -0.35], armL: [-0.6, 0, 0.7], dogEar: [-0.9, 0, 0] }, bodyY: 0.1 },
      { t: 0.92, pose: { body: [-0.27, 0, 0.04], mid: [-0.38, 0, 0], top: [-0.54, 0, 0], armR: [-2.55, 0, -0.32], armL: [-0.6, 0, 0.7], dogEar: [-0.95, 0, 0] }, bodyY: 0.1 },
      { t: 1.0, pose: { body: [-0.25, 0, -0.04], mid: [-0.37, 0, 0], top: [-0.52, 0, 0], armR: [-2.5, 0, -0.36], armL: [-0.6, 0, 0.7], dogEar: [-0.9, 0, 0] }, bodyY: 0.1 },
    ]),
    clip("attack", 0.42, [
      { t: 0, pose: { body: [-0.25, 0, 0], mid: [-0.37, 0, 0], top: [-0.52, 0, 0], armR: [-2.5, 0, -0.36], armL: [-0.6, 0, 0.7], dogEar: [-0.9, 0, 0] }, bodyY: 0.1 },
      { t: 0.08, pose: { body: [0.45, 0, 0], mid: [0.4, 0, 0], top: [0.55, 0, 0], armR: [0.7, 0, -0.2], armL: [0.3, 0, 0.4], dogEar: [0.6, 0, 0] }, bodyY: -0.08 },
      { t: 0.18, pose: { body: [0.38, 0, 0], mid: [0.3, 0, 0], top: [0.35, 0, 0], armR: [0.55, 0, -0.25], armL: [0.2, 0, 0.4], dogEar: [0.3, 0, 0] }, bodyY: -0.06 },
      { t: 0.42, pose: {} },
    ]),
    clip("hurt", 0.32, [
      { t: 0, pose: {} },
      { t: 0.05, pose: { body: [-0.32, 0, 0.12], mid: [0.25, 0, 0], top: [-0.4, 0, 0], armL: [-0.8, 0, 1.0], armR: [-0.8, 0, -1.0], dogEar: [0.7, 0, 0] }, bodyY: 0.06, scale: 0.92 },
      { t: 0.14, pose: { body: [-0.1, 0, -0.06], mid: [0.08, 0, 0], top: [-0.1, 0, 0] }, scale: 1.02 },
      { t: 0.32, pose: {}, scale: 1 },
    ]),
    clip("defeat", 1.2, [
      { t: 0, pose: {}, scale: 1 },
      { t: 0.18, pose: { body: [-0.4, 0.5, 0.3], mid: [0.6, 0, 0], top: [0.9, 0, 0], armL: [-1.2, 0, 1.3], armR: [-1.2, 0, -1.3], dogEar: [1.2, 0, 0] }, bodyY: 0.12, scale: 0.9 },
      { t: 0.6, pose: { body: [0.3, 2.2, 0.8], mid: [1.1, 0, 0], top: [1.6, 0, 0], armL: [-1.8, 0, 1.6], armR: [-1.8, 0, -1.6], dogEar: [1.6, 0, 0] }, bodyY: -0.15, scale: 0.55 },
      { t: 1.2, pose: { body: [1.2, 3.4, 1.1], mid: [1.3, 0, 0], top: [1.8, 0, 0], armL: [-2.0, 0, 1.7], armR: [-2.0, 0, -1.7], dogEar: [1.8, 0, 0] }, bodyY: -0.3, scale: 0.32 },
    ]),
  ];
}

export function paintQuizAtlas(): Raster {
  const P = QUIZ.palette;
  const r = new Raster(S, hex(P.paper));
  const paper = hex(P.paper);
  const back = hex(P.paperBack);
  const ink = hex(P.ink);
  const red = hex(P.red);
  const grain = (u: number, v: number) => 0.97 + pfbm(u, v, 8, 3, 7) * 0.05;
  r.paint(QUIZ_CELLS.front, (u, v) => shade(paper, grain(u, v)));
  r.paint(QUIZ_CELLS.back, (u, v) => {
    const line = v > 0.3 && Math.abs(((v * 18) % 1) - 0.5) < 0.04 ? 0.94 : 1;
    return shade(back, grain(u, v) * line);
  });
  r.paint(QUIZ_CELLS.paper, (u, v) => shade(paper, grain(u, v)));
  r.paint(QUIZ_CELLS.pencil, (u, v) => {
    const facet = Math.floor(u * 6) % 2 ? 0.88 : 1;
    return shade(mixColor(hex(P.pencil), hex(P.pencilDark), 0.15), facet * (0.96 + pfbm(u, v, 4, 2, 9) * 0.06));
  });
  r.paint(QUIZ_CELLS.wood, (u, v) => (v > 0.78 ? hex(P.graphite) : shade(hex(P.wood), 0.95 + pfbm(u, v, 8, 2, 3) * 0.1)));
  r.paint(QUIZ_CELLS.eraser, () => hex(P.eraser));
  r.paint(QUIZ_CELLS.ferrule, (u, v) => shade(hex(P.ferrule), 0.8 + 0.3 * Math.abs(Math.sin(v * Math.PI * 6))));
  r.paint(QUIZ_CELLS.graphite, () => hex(P.graphite));
  r.paint(QUIZ_CELLS.red, () => red);

  // Printed exam on the front (cell 256 px; PartBuilder pads 3 px).
  const f = QUIZ_CELLS.front;
  const px = (u: number, vUp: number): [number, number] => [f.x + 3 + u * (f.w - 6), f.y + 3 + (1 - vUp) * (f.h - 6)];
  // Header band with block "characters" and a name box.
  const [hx0, hy0] = px(0.08, 0.95);
  const [hx1, hy1] = px(0.92, 0.84);
  for (let y = Math.round(hy0); y < hy1; y++) for (let x = Math.round(hx0); x < hx1; x++) r.blend(x, y, hex("#e7dcc0"), 1);
  for (let i = 0; i < 4; i++) {
    const [gx, gy] = px(0.12 + i * 0.075, 0.895);
    r.stroke([[gx, gy - 7], [gx + 10, gy - 7]], 2.4, 2.4, ink);
    r.stroke([[gx + 5, gy - 10], [gx + 5, gy + 7]], 2.4, 2.4, ink);
    r.stroke([[gx, gy + 2], [gx + 10, gy + 4]], 2.2, 2.2, ink);
  }
  const [nx, ny] = px(0.5, 0.895);
  r.stroke([[nx, ny + 6], [nx + 70, ny + 6]], 1.4, 1.4, ink);
  // Score circle with a red zero, top right.
  const [sx, sy] = px(0.875, 0.805);
  r.ellipse(sx, sy, 24, 24, hex(P.red, 0.9), 0, 1);
  r.ellipse(sx, sy, 20, 20, paper, 0, 1);
  r.ellipse(sx, sy, 10, 14, hex(P.red), 0, 1);
  r.ellipse(sx, sy, 6, 10, paper, 0, 1);
  // Face: answer-bubble eyes with catch-lights, angry red brows, torn mouth.
  for (const side of [-1, 1]) {
    const [ex, ey] = px(0.5 + side * 0.17, 0.6);
    r.ellipse(ex, ey, 21, 25, ink, 0, 1.2);
    r.ellipse(ex - side * 2, ey - 2, 17, 21, hex("#121022"), 0, 1);
    r.ellipse(ex + 6, ey - 9, 6, 8, hex("#ffffff"), 0, 1);
    r.ellipse(ex - 5, ey + 9, 3, 3, hex("#ffffff", 0.85), 0, 1);
    // Angry: inner ends low toward the nose, outer ends high.
    const [bx, by] = px(0.5 + side * 0.17, 0.72);
    r.stroke([[bx - side * 30, by + 10], [bx + side * 22, by - 8]], 9, 5, red);
  }
  const mouth: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const [mx, my] = px(0.34 + i * 0.04, 0.44 + (i % 2 ? 0.035 : 0));
    mouth.push([mx, my]);
  }
  r.stroke(mouth, 5, 5, ink);
  // Question rows: numbers, answer bubbles and ruled lines.
  for (let row = 0; row < 5; row++) {
    const v = 0.33 - row * 0.065;
    const [lx, ly] = px(0.08, v);
    r.stroke([[lx, ly - 6], [lx + 1, ly + 6]], 2.2, 2.2, ink);
    for (let k = 0; k < 4; k++) {
      const [bx, by] = px(0.2 + k * 0.08, v);
      r.ellipse(bx, by, 5, 5, ink, 0, 0.8);
      r.ellipse(bx, by, 3.6, 3.6, row === k % 5 ? ink : paper, 0, 0.8);
    }
    const [rx0, ry] = px(0.55, v - 0.02);
    const [rx1] = px(0.92, v - 0.02);
    r.stroke([[rx0, ry], [rx1, ry]], 1.2, 1.2, hex("#9fb4c9"));
    // Red marking: crosses on wrong answers, one tick.
    const [mx, my] = px(0.88, v + 0.012);
    if (row === 2) {
      r.stroke([[mx - 8, my], [mx - 2, my + 7], [mx + 9, my - 9]], 3.4, 3.4, red);
    } else {
      r.stroke([[mx - 7, my - 7], [mx + 7, my + 7]], 3.2, 3.2, red);
      r.stroke([[mx + 7, my - 7], [mx - 7, my + 7]], 3.2, 3.2, red);
    }
  }
  return r;
}
