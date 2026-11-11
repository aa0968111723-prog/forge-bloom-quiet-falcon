/**
 * 期中考監視者 — the midterm invigilator.
 *
 * A tall floating robe that flares to a hem of torn answer sheets, a high
 * stiff collar, white-gloved hands holding a long ruler and a stopwatch,
 * and for a head a clock face with one watching eye, clock hands for brows
 * and a mortarboard on top. Tall and narrow above, wide below.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PartBuilder, smoothstep, type V3 } from "../../shared/builder.ts";
import { hring, limbRing, loft, sweep } from "../../shared/loft.ts";
import { Raster, hex, mixColor, pfbm, shade } from "../../shared/raster.ts";
import { creatureCell as cell, creatureClip, creatureRig, loopKeys, type CreatureKey } from "../shared/creature.ts";

export const EXAM = {
  id: "creature.exam",
  version: 1,
  atlasSize: 512,
  palette: { robe: "#2f3b5c", robeLight: "#4a5a82", gold: "#d4ad62", face: "#f6efdc", ink: "#20202c", red: "#c8414b", glove: "#f3f1ea", wood: "#d8b27a", board: "#23232b", iris: "#e0a548" },
  bones: [
    { name: "root", parent: null, offset: [0, 0, 0] },
    { name: "body", parent: "root", offset: [0, 0.3, 0] },
    { name: "chest", parent: "body", offset: [0, 1.05, 0] },
    { name: "head", parent: "chest", offset: [0, 0.42, 0.02] },
    { name: "hands", parent: "head", offset: [0, 0.16, 0.06] },
    { name: "armL", parent: "chest", offset: [0.3, 0.12, 0] },
    { name: "armR", parent: "chest", offset: [-0.3, 0.12, 0] },
    { name: "hem", parent: "body", offset: [0, 0.1, 0] },
  ],
} as const;

export const EXAM_CELLS = {
  face: cell(0, 0, 2, 2),
  robe: cell(2, 0),
  gold: cell(3, 0),
  paper: cell(2, 1),
  glove: cell(3, 1),
  wood: cell(0, 2),
  board: cell(1, 2),
  ink: cell(2, 2),
  red: cell(3, 2),
} as const;

export function buildExam() {
  const r = creatureRig(EXAM.bones);
  const b = new PartBuilder(EXAM.atlasSize);
  const i = r.index;
  const body = r.at("body");
  const chest = r.at("chest");
  const head = r.at("head");
  // Robe: chest down to a wide hem; the lower third sways on the hem bone.
  const levels: [number, number][] = [
    [chest.y + 0.12, 0.27],
    [chest.y - 0.12, 0.3],
    [chest.y - 0.45, 0.36],
    [chest.y - 0.8, 0.5],
    [body.y + 0.12, 0.66],
    [body.y - 0.05, 0.72],
  ];
  const robe = loft(levels.map(([y, rr]) => hring([0, y, 0], rr, rr * 0.82, { shape: (th) => 1 + 0.04 * Math.sin(th * 10) * smoothstep(chest.y - 0.3, body.y, y) })), { segments: 22, thickness: 0.02 });
  b.add(robe.geometry, {
    name: "robe",
    color: (_p, _t, _u, sh) => new THREE.Color(1, 1, 1).multiplyScalar(sh === 1 ? 0.5 : 1),
    tile: EXAM_CELLS.robe,
    skin: (p) => {
      const sway = smoothstep(chest.y - 0.5, body.y, p.y);
      const top = smoothstep(chest.y - 0.3, chest.y + 0.05, p.y);
      return [
        [i("chest"), top],
        [i("body"), (1 - top) * (1 - sway)],
        [i("hem"), (1 - top) * sway],
      ];
    },
  });
  // Torn answer-sheet hem.
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const strip = new THREE.PlaneGeometry(0.16, 0.22 + (k % 3) * 0.05);
    strip.rotateY(-a + Math.PI / 2);
    strip.translate(Math.cos(a) * 0.68, body.y - 0.14, Math.sin(a) * 0.56);
    b.add(strip, { name: "answer-strip", color: "#ffffff", tile: EXAM_CELLS.paper, skin: i("hem") });
    const back = strip.clone();
    const ix = back.index!.array as Uint16Array;
    for (let n = 0; n < ix.length; n += 3) [ix[n + 1], ix[n + 2]] = [ix[n + 2], ix[n + 1]];
    back.computeVertexNormals();
    b.add(back, { name: "answer-strip-back", color: "#e8e1cf", tile: EXAM_CELLS.paper, skin: i("hem") });
  }
  // Pinned answer sheets on the robe front.
  for (const [x, y, rot] of [[-0.14, chest.y - 0.35, 0.12], [0.17, chest.y - 0.6, -0.1]] as const) {
    const sheet = new THREE.PlaneGeometry(0.2, 0.26);
    sheet.rotateZ(rot);
    sheet.translate(x, y, 0.38 - (chest.y - y) * 0.15 + 0.06);
    b.add(sheet, { name: "pinned-sheet", color: "#ffffff", tile: EXAM_CELLS.paper, skin: i("chest") });
  }
  // Stiff collar and gold trim.
  const collar = loft([hring([0, chest.y + 0.1, 0], 0.26, 0.22), hring([0, chest.y + 0.26, 0.01], 0.22, 0.2), hring([0, chest.y + 0.33, 0.02], 0.25, 0.23)], { segments: 18, thickness: 0.015 });
  b.add(collar.geometry, { name: "collar", color: "#ffffff", tile: EXAM_CELLS.robe, skin: i("chest") });
  const trim = new THREE.TorusGeometry(0.25, 0.018, 6, 24);
  trim.rotateX(Math.PI / 2);
  trim.translate(0, chest.y + 0.33, 0.02);
  b.add(trim, { name: "collar-trim", color: "#ffffff", tile: EXAM_CELLS.gold, skin: i("chest") });
  // Head: clock face with the eye, gold bezel, hands as brows, mortarboard.
  const disk = new THREE.CylinderGeometry(0.34, 0.34, 0.1, 28);
  disk.rotateX(Math.PI / 2);
  disk.translate(head.x, head.y + 0.16, head.z);
  b.add(disk, { name: "clock-head", color: "#ffffff", tile: EXAM_CELLS.gold, skin: i("head") });
  const face = new THREE.CircleGeometry(0.31, 28);
  face.translate(head.x, head.y + 0.16, head.z + 0.052);
  b.add(face, { name: "clock-face", color: "#ffffff", tile: EXAM_CELLS.face, skin: i("head") });
  for (const [len, w, rot] of [[0.2, 0.02, 0.5], [0.24, 0.016, -0.42]] as const) {
    const hand = new THREE.BoxGeometry(len, w, 0.012);
    hand.translate(len * 0.42, 0, 0);
    hand.rotateZ(rot + Math.PI / 2 + (rot > 0 ? 0.6 : -0.6));
    hand.translate(head.x, head.y + 0.16, head.z + 0.065);
    b.add(hand, { name: "clock-hand", color: "#ffffff", tile: EXAM_CELLS.ink, skin: i("hands") });
  }
  const board = new RoundedBoxGeometry(0.62, 0.04, 0.62, 1, 0.01);
  board.rotateY(Math.PI / 4);
  board.rotateX(-0.12);
  board.translate(head.x, head.y + 0.53, head.z - 0.02);
  b.add(board, { name: "mortarboard", color: "#ffffff", tile: EXAM_CELLS.board, skin: i("head") });
  const cap = new THREE.CylinderGeometry(0.17, 0.2, 0.12, 14);
  cap.translate(head.x, head.y + 0.47, head.z - 0.02);
  b.add(cap, { name: "mortarboard-cap", color: "#ffffff", tile: EXAM_CELLS.board, skin: i("head") });
  const tassel = sweep([[head.x, head.y + 0.56, head.z - 0.02], [head.x + 0.2, head.y + 0.56, head.z + 0.08], [head.x + 0.3, head.y + 0.4, head.z + 0.12]], { width: () => 0.012, thickness: () => 0.012, outward: [0, 1, 0], segments: 6, around: 5 });
  b.add(tassel.geometry, { name: "tassel", color: "#ffffff", tile: EXAM_CELLS.gold, skin: i("head") });
  // Halo of hour ticks behind the head.
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const tick = new THREE.BoxGeometry(0.04, k % 3 ? 0.08 : 0.14, 0.02);
    tick.rotateZ(-a);
    tick.translate(head.x + Math.sin(a) * 0.5, head.y + 0.16 + Math.cos(a) * 0.5, head.z - 0.12);
    b.add(tick, { name: "halo-tick", color: "#ffffff", tile: EXAM_CELLS.gold, skin: i("head") });
  }
  // Sleeved arms with gloves; ruler in the right hand, stopwatch in the left.
  for (const side of [1, -1] as const) {
    const bone = side > 0 ? "armL" : "armR";
    const s = r.at(bone);
    const pts: V3[] = [[s.x, s.y, s.z], [s.x + side * 0.12, s.y - 0.3, s.z + 0.06], [s.x + side * 0.16, s.y - 0.62, s.z + 0.16]];
    const sleeve = loft(
      pts.map((c, k) => limbRing(c, [side * 0.25, -1, 0.3], [0, 0, 1], 0.1 + k * 0.012, 0.09 + k * 0.012)),
      { segments: 12, thickness: 0.012 },
    );
    b.add(sleeve.geometry, { name: "sleeve", color: "#ffffff", tile: EXAM_CELLS.robe, skin: i(bone) });
    const hand = pts[2];
    const glove = new THREE.SphereGeometry(0.075, 12, 8);
    glove.scale(1, 1.15, 0.85);
    glove.translate(hand[0], hand[1] - 0.06, hand[2] + 0.02);
    b.add(glove, { name: "glove", color: "#ffffff", tile: EXAM_CELLS.glove, skin: i(bone) });
    if (side < 0) {
      const ruler = new THREE.BoxGeometry(0.07, 1.25, 0.018);
      ruler.rotateX(0.35);
      ruler.translate(hand[0], hand[1] + 0.2, hand[2] + 0.12);
      b.add(ruler, { name: "ruler", color: "#ffffff", tile: EXAM_CELLS.wood, skin: i(bone) });
    } else {
      const watch = new THREE.CylinderGeometry(0.09, 0.09, 0.035, 18);
      watch.rotateX(Math.PI / 2);
      watch.translate(hand[0], hand[1] - 0.06, hand[2] + 0.1);
      b.add(watch, { name: "stopwatch", color: "#ffffff", tile: EXAM_CELLS.gold, skin: i(bone) });
      const dial = new THREE.CircleGeometry(0.075, 18);
      dial.translate(hand[0], hand[1] - 0.06, hand[2] + 0.119);
      b.add(dial, { name: "stopwatch-dial", color: "#ffffff", tile: EXAM_CELLS.glove, skin: i(bone) });
    }
  }
  const geometry = b.build();
  const material = new THREE.MeshStandardMaterial({ name: "exam-atlas", vertexColors: true, roughness: 0.7, side: THREE.FrontSide });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "exam";
  mesh.add(r.root);
  mesh.bind(r.skeleton);
  const scene = new THREE.Group();
  scene.name = "creature-exam";
  scene.add(mesh);
  scene.userData = { artId: EXAM.id, artVersion: EXAM.version, labelHeight: 2.75 };
  return { scene, clips: examClips(), atlasPng: paintExamAtlas().toPNG(), parts: b.parts, triangles: b.triangleCount, bones: r.names };
}

function examClips() {
  const base = EXAM.bones[1].offset[1];
  const clip = (name: string, duration: number, keys: CreatureKey[]) => creatureClip(name, duration, keys, { bone: "body", base });
  const float = (period: number, amp: number, lean: number) =>
    loopKeys(period, 8, (p) => ({
      pose: {
        body: [lean, 0, Math.sin(p) * amp * 0.4],
        hem: [Math.sin(p + 1) * amp * 1.2 - lean * 0.8, 0, Math.cos(p) * amp * 0.6],
        head: [Math.sin(p * 2) * amp * 0.4, Math.sin(p) * amp * 2.5, 0],
        hands: [0, 0, p],
        armL: [-0.2 + Math.sin(p) * amp, 0, 0.12],
        armR: [-0.35 - Math.sin(p) * amp, 0, -0.12],
      },
      bodyY: Math.sin(p) * 0.06,
    }));
  return [
    clip("idle", 3.2, float(3.2, 0.06, 0)),
    clip("chase", 1.2, float(1.2, 0.1, 0.18)),
    clip("windup", 1.0, [
      { t: 0, pose: {} },
      { t: 0.4, pose: { body: [-0.12, 0, 0], head: [-0.15, 0, 0], hands: [0, 0, 3], armR: [-2.2, 0, -0.5], armL: [-0.8, 0, 0.6], hem: [0.2, 0, 0] }, bodyY: 0.1 },
      { t: 0.88, pose: { body: [-0.2, 0, 0], head: [-0.25, 0, 0], hands: [0, 0, 6.2], armR: [-2.9, 0, -0.35], armL: [-1.0, 0, 0.7], hem: [0.3, 0, 0] }, bodyY: 0.2 },
      { t: 0.94, pose: { body: [-0.22, 0, 0.04], head: [-0.27, 0, 0.03], hands: [0, 0, 6.6], armR: [-2.95, 0, -0.32], armL: [-1.0, 0, 0.72], hem: [0.32, 0, 0] }, bodyY: 0.2 },
      { t: 1.0, pose: { body: [-0.2, 0, -0.04], head: [-0.25, 0, -0.03], hands: [0, 0, 7.0], armR: [-2.9, 0, -0.35], armL: [-1.0, 0, 0.7], hem: [0.3, 0, 0] }, bodyY: 0.2 },
    ]),
    clip("attack", 0.5, [
      { t: 0, pose: { body: [-0.2, 0, 0], head: [-0.25, 0, 0], armR: [-2.9, 0, -0.35], armL: [-1.0, 0, 0.7], hem: [0.3, 0, 0] }, bodyY: 0.2 },
      { t: 0.1, pose: { body: [0.35, 0, 0], head: [0.2, 0, 0], armR: [-0.3, 0, 0.3], armL: [0.2, 0, 0.4], hem: [-0.35, 0, 0] }, bodyY: -0.1 },
      { t: 0.22, pose: { body: [0.28, 0, 0], head: [0.15, 0, 0], armR: [-0.4, 0, 0.35], armL: [0.1, 0, 0.4], hem: [-0.2, 0, 0] }, bodyY: -0.06 },
      { t: 0.5, pose: {} },
    ]),
    clip("hurt", 0.4, [
      { t: 0, pose: {} },
      { t: 0.06, pose: { body: [-0.3, 0, 0.12], head: [-0.4, 0.3, 0.15], armL: [-0.6, 0, 1.0], armR: [-0.6, 0, -1.0], hem: [0.4, 0, 0] }, bodyY: 0.08, scale: 0.95 },
      { t: 0.18, pose: { body: [-0.1, 0, -0.04], head: [-0.1, 0, 0] }, scale: 1.02 },
      { t: 0.4, pose: {}, scale: 1 },
    ]),
    clip("defeat", 1.5, [
      { t: 0, pose: {}, scale: 1 },
      { t: 0.25, pose: { body: [-0.35, 0, 0.25], head: [-0.6, 0.6, 0.4], armL: [-1.4, 0, 1.4], armR: [-1.4, 0, -1.4], hem: [0.6, 0, 0], hands: [0, 0, 4] }, bodyY: 0.15, scale: 0.95 },
      { t: 0.8, pose: { body: [0.9, 0.5, 0.6], head: [0.8, 1.2, 0.9], armL: [0.6, 0, 1.6], armR: [0.6, 0, -1.6], hem: [-0.8, 0, 0], hands: [0, 0, 9] }, bodyY: -0.2, scale: 0.7 },
      { t: 1.5, pose: { body: [1.5, 0.8, 0.9], head: [1.2, 1.5, 1.2], armL: [1.0, 0, 1.7], armR: [1.0, 0, -1.7], hem: [-1.1, 0, 0], hands: [0, 0, 12] }, bodyY: -0.38, scale: 0.4 },
    ]),
  ];
}

export function paintExamAtlas(): Raster {
  const P = EXAM.palette;
  const r = new Raster(EXAM.atlasSize, hex(P.face));
  const robe = hex(P.robe);
  const robeLight = hex(P.robeLight);
  r.paint(EXAM_CELLS.robe, (u, v) => {
    const fold = Math.sin(u * Math.PI * 2 * 5) * 0.5 + 0.5;
    return shade(mixColor(robe, robeLight, fold * 0.35), 0.92 + pfbm(u, v, 4, 3, 41) * 0.1);
  });
  r.paint(EXAM_CELLS.gold, (u, v) => shade(hex(P.gold), 0.78 + 0.4 * Math.exp(-Math.pow((v - 0.35) / 0.2, 2))));
  r.paint(EXAM_CELLS.glove, (u, v) => shade(hex(P.glove), 0.95 + pfbm(u, v, 4, 2, 43) * 0.05));
  r.paint(EXAM_CELLS.board, () => hex(P.board));
  r.paint(EXAM_CELLS.ink, () => hex(P.ink));
  r.paint(EXAM_CELLS.red, () => hex(P.red));
  r.paint(EXAM_CELLS.wood, (u, v) => {
    const mark = Math.abs(((v * 30) % 1) - 0.5) > 0.44 && u < (Math.round(v * 30) % 5 ? 0.25 : 0.45) ? 0.55 : 1;
    return shade(hex(P.wood), mark * (0.95 + pfbm(u, v, 8, 2, 45) * 0.08));
  });
  r.paint(EXAM_CELLS.paper, (u, v) => {
    const line = v > 0.15 && Math.abs(((v * 10) % 1) - 0.5) < 0.05 ? 0.86 : 1;
    const bubble = u < 0.25 && Math.hypot((u % 0.1) - 0.05, (v % 0.1) - 0.05) < 0.03 ? 0.6 : 1;
    return shade(hex("#f5eedc"), line * bubble);
  });
  // Clock face with one watching eye.
  const F = EXAM_CELLS.face;
  const cx = F.x + F.w / 2;
  const cy = F.y + F.h / 2;
  const ink = hex(P.ink);
  r.paint(F, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    return shade(hex(P.face), d > 0.47 ? 0.85 : 1 - d * 0.12);
  });
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * Math.PI * 2;
    const big = k % 5 === 0;
    const r0 = big ? 98 : 106;
    r.stroke([[cx + Math.sin(a) * r0, cy - Math.cos(a) * r0], [cx + Math.sin(a) * 114, cy - Math.cos(a) * 114]], big ? 6 : 2, big ? 6 : 2, ink);
  }
  r.ellipse(cx, cy + 6, 62, 40, hex("#fbf8f0"), 0, 1.5);
  for (let y = cy - 40; y <= cy + 52; y++) {
    for (let x = cx - 36; x <= cx + 36; x++) {
      const d = Math.hypot((x - cx) / 34, (y - cy - 6) / 34);
      if (d > 1.04) continue;
      const c = mixColor(hex(P.iris), hex("#9a5a1e"), Math.min(1, d * 1.1));
      r.blend(x, y, d > 0.92 ? shade(c, 0.5) : c, d > 1 ? (1.04 - d) / 0.04 : 1);
    }
  }
  r.ellipse(cx, cy + 6, 8, 30, hex("#141018"), 0, 1);
  r.ellipse(cx + 12, cy - 8, 8, 9, hex("#ffffff"), 0, 1);
  r.stroke([[cx - 66, cy + 2], [cx - 30, cy - 34], [cx + 30, cy - 34], [cx + 66, cy + 2]], 5, 5, ink);
  r.stroke([[cx - 58, cy + 26], [cx, cy + 44], [cx + 58, cy + 26]], 2.5, 2.5, hex(P.ink, 0.7));
  r.stroke([[cx, cy + 70], [cx, cy + 104]], 3, 3, hex(P.red));
  return r;
}
