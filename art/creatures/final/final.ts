/**
 * 期末 · 截止日 — the deadline itself.
 *
 * A giant crimson twin-bell alarm clock on stout legs. Its face carries the
 * angry eyes; a tear-off calendar hangs from its chest with the due date
 * circled; its arms are clock hands sharpened into blades; the hammer
 * between the bells rattles as it winds up. Biggest silhouette on campus.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PartBuilder, type V3 } from "../../shared/builder.ts";
import { dome } from "../../shared/loft.ts";
import { Raster, hex, mixColor, pfbm, shade } from "../../shared/raster.ts";
import { creatureCell as cell, creatureClip, creatureRig, loopKeys, type CreatureKey } from "../shared/creature.ts";

export const FINAL = {
  id: "creature.final",
  version: 1,
  atlasSize: 512,
  palette: { crimson: "#a83a44", crimsonLight: "#d65a5c", brass: "#d7b066", face: "#f7efd9", ink: "#1f1d26", red: "#c8414b", iron: "#3b3c45", paper: "#f6f1e4" },
  bones: [
    { name: "root", parent: null, offset: [0, 0, 0] },
    { name: "body", parent: "root", offset: [0, 1.45, 0] },
    { name: "bellL", parent: "body", offset: [0.62, 0.95, 0] },
    { name: "bellR", parent: "body", offset: [-0.62, 0.95, 0] },
    { name: "hammer", parent: "body", offset: [0, 1.0, 0] },
    { name: "calendar", parent: "body", offset: [0, -0.5, 0.5] },
    { name: "armL", parent: "body", offset: [1.05, 0.1, 0] },
    { name: "armR", parent: "body", offset: [-1.05, 0.1, 0] },
    { name: "legL", parent: "root", offset: [0.45, 0.62, 0] },
    { name: "legR", parent: "root", offset: [-0.45, 0.62, 0] },
  ],
} as const;

export const FINAL_CELLS = {
  face: cell(0, 0, 2, 2),
  crimson: cell(2, 0),
  brass: cell(3, 0),
  calendar: cell(2, 1, 2, 1),
  iron: cell(0, 2),
  blade: cell(1, 2),
  page: cell(2, 2),
  red: cell(3, 2),
} as const;

export function buildFinal() {
  const r = creatureRig(FINAL.bones);
  const b = new PartBuilder(FINAL.atlasSize);
  const i = r.index;
  const body = r.at("body");
  // Clock case, bezel and face (faces +Z).
  const caseG = new THREE.CylinderGeometry(1.0, 1.0, 0.62, 36, 1);
  caseG.rotateX(Math.PI / 2);
  caseG.translate(body.x, body.y, body.z - 0.05);
  b.add(caseG, { name: "clock-case", color: "#ffffff", tile: FINAL_CELLS.crimson, skin: i("body") });
  const bezel = new THREE.TorusGeometry(0.93, 0.08, 10, 40);
  bezel.translate(body.x, body.y, body.z + 0.27);
  b.add(bezel, { name: "bezel", color: "#ffffff", tile: FINAL_CELLS.brass, skin: i("body") });
  const face = new THREE.CircleGeometry(0.9, 40);
  face.translate(body.x, body.y, body.z + 0.265);
  b.add(face, { name: "clock-face", color: "#ffffff", tile: FINAL_CELLS.face, skin: i("body") });
  const back = new THREE.CircleGeometry(1.0, 36);
  back.rotateY(Math.PI);
  back.translate(body.x, body.y, body.z - 0.36);
  b.add(back, { name: "clock-back", color: "#cfcfcf", tile: FINAL_CELLS.crimson, skin: i("body") });
  // Winding key on the back.
  const key = new RoundedBoxGeometry(0.42, 0.24, 0.05, 1, 0.04);
  key.translate(body.x, body.y + 0.1, body.z - 0.48);
  b.add(key, { name: "winding-key", color: "#ffffff", tile: FINAL_CELLS.brass, skin: i("body") });
  // Twin bells and the hammer between them.
  for (const side of [1, -1] as const) {
    const bone = side > 0 ? "bellL" : "bellR";
    const p = r.at(bone);
    const bell = dome(0.36, 0.3, 0.36, 6, 20);
    bell.geometry.rotateZ(side * -0.5);
    bell.geometry.translate(p.x, p.y, p.z - 0.05);
    b.add(bell.geometry, { name: "bell", color: "#ffffff", tile: FINAL_CELLS.brass, skin: i(bone) });
    const stem = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
    stem.rotateZ(side * -0.6);
    stem.translate(p.x - side * 0.13, p.y - 0.12, p.z - 0.05);
    b.add(stem, { name: "bell-stem", color: "#ffffff", tile: FINAL_CELLS.iron, skin: i("body") });
  }
  const h = r.at("hammer");
  const hammerArm = new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8);
  hammerArm.translate(h.x, h.y + 0.05, h.z - 0.05);
  b.add(hammerArm, { name: "hammer-arm", color: "#ffffff", tile: FINAL_CELLS.iron, skin: i("hammer") });
  const hammerHead = new THREE.SphereGeometry(0.1, 10, 8);
  hammerHead.translate(h.x, h.y + 0.25, h.z - 0.05);
  b.add(hammerHead, { name: "hammer-head", color: "#ffffff", tile: FINAL_CELLS.brass, skin: i("hammer") });
  // Tear-off calendar with the due date circled.
  const c = r.at("calendar");
  const pad = new RoundedBoxGeometry(0.72, 0.6, 0.1, 2, 0.02);
  pad.translate(c.x, c.y - 0.28, c.z);
  b.add(pad, { name: "calendar-pad", color: "#ffffff", tile: FINAL_CELLS.page, skin: i("calendar") });
  const sheet = new THREE.PlaneGeometry(0.68, 0.56);
  sheet.translate(c.x, c.y - 0.28, c.z + 0.052);
  b.add(sheet, { name: "calendar-sheet", color: "#ffffff", tile: FINAL_CELLS.calendar, skin: i("calendar") });
  const ring = new THREE.TorusGeometry(0.05, 0.012, 6, 12);
  for (const x of [-0.2, 0.2]) {
    const rr = ring.clone();
    rr.rotateY(Math.PI / 2);
    rr.translate(c.x + x, c.y + 0.02, c.z);
    b.add(rr, { name: "calendar-ring", color: "#ffffff", tile: FINAL_CELLS.brass, skin: i("calendar") });
  }
  ring.dispose();
  // Clock-hand blades for arms.
  for (const side of [1, -1] as const) {
    const bone = side > 0 ? "armL" : "armR";
    const s = r.at(bone);
    const shoulder = new THREE.SphereGeometry(0.2, 12, 8);
    shoulder.translate(s.x, s.y, s.z);
    b.add(shoulder, { name: "shoulder", color: "#ffffff", tile: FINAL_CELLS.brass, skin: i(bone) });
    const blade = new THREE.Shape();
    blade.moveTo(-0.09, 0);
    blade.lineTo(0.09, 0);
    blade.lineTo(0.15, -0.9);
    blade.lineTo(0, -1.45);
    blade.lineTo(-0.15, -0.9);
    blade.closePath();
    const g = new THREE.ExtrudeGeometry(blade, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    g.translate(0, -0.12, -0.03);
    g.rotateZ(side * 0.25);
    g.translate(s.x + side * 0.05, s.y, s.z + 0.05);
    b.add(g, { name: "hand-blade", color: "#ffffff", tile: FINAL_CELLS.blade, skin: i(bone) });
  }
  // Stout legs and feet.
  for (const side of [1, -1] as const) {
    const bone = side > 0 ? "legL" : "legR";
    const l = r.at(bone);
    const leg = new THREE.CylinderGeometry(0.17, 0.2, 0.6, 12);
    leg.translate(l.x, l.y - 0.3, l.z);
    b.add(leg, { name: "leg", color: "#ffffff", tile: FINAL_CELLS.iron, skin: i(bone) });
    const foot = new RoundedBoxGeometry(0.44, 0.16, 0.6, 2, 0.06);
    foot.translate(l.x, 0.08, l.z + 0.08);
    b.add(foot, { name: "foot", color: "#ffffff", tile: FINAL_CELLS.brass, skin: i(bone) });
  }
  const geometry = b.build();
  const material = new THREE.MeshStandardMaterial({ name: "final-atlas", vertexColors: true, roughness: 0.48, metalness: 0.15 });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "final";
  mesh.add(r.root);
  mesh.bind(r.skeleton);
  const scene = new THREE.Group();
  scene.name = "creature-final";
  scene.add(mesh);
  scene.userData = { artId: FINAL.id, artVersion: FINAL.version, labelHeight: 3.35 };
  return { scene, clips: finalClips(), atlasPng: paintFinalAtlas().toPNG(), parts: b.parts, triangles: b.triangleCount, bones: r.names };
}

function finalClips() {
  const base = FINAL.bones[1].offset[1];
  const clip = (name: string, duration: number, keys: CreatureKey[]) => creatureClip(name, duration, keys, { bone: "body", base });
  const stomp = (period: number, amp: number, lean: number, ring = 0) =>
    loopKeys(period, 8, (p) => ({
      pose: {
        body: [lean, Math.sin(p) * amp * 0.5, Math.sin(p) * amp * 0.6],
        bellL: [0, 0, Math.sin(p * 4) * ring],
        bellR: [0, 0, -Math.sin(p * 4) * ring],
        hammer: [0, 0, Math.sin(p * 8) * (ring * 4 + 0.05)],
        calendar: [Math.sin(p * 2) * amp * 1.5, 0, 0],
        armL: [Math.sin(p) * amp * 2, 0, 0.25],
        armR: [-Math.sin(p) * amp * 2, 0, -0.25],
        legL: [-Math.sin(p) * amp * 2.4, 0, 0],
        legR: [Math.sin(p) * amp * 2.4, 0, 0],
      },
      bodyY: Math.abs(Math.cos(p)) * amp * 0.5,
    }));
  return [
    clip("idle", 3.0, stomp(3.0, 0.04, 0, 0.02)),
    clip("chase", 1.1, stomp(1.1, 0.12, 0.12, 0.05)),
    clip("windup", 1.0, [
      { t: 0, pose: {} },
      { t: 0.4, pose: { body: [-0.1, 0, 0], armL: [-1.5, 0, 0.6], armR: [-1.5, 0, -0.6], bellL: [0, 0, 0.12], bellR: [0, 0, -0.12], hammer: [0, 0, 0.4], calendar: [-0.5, 0, 0] }, bodyY: 0.08 },
      { t: 0.6, pose: { body: [-0.14, 0, 0.02], armL: [-2.2, 0, 0.5], armR: [-2.2, 0, -0.5], bellL: [0, 0, -0.1], bellR: [0, 0, 0.1], hammer: [0, 0, -0.45], calendar: [-0.6, 0, 0] }, bodyY: 0.12 },
      { t: 0.8, pose: { body: [-0.18, 0, -0.02], armL: [-2.7, 0, 0.42], armR: [-2.7, 0, -0.42], bellL: [0, 0, 0.12], bellR: [0, 0, -0.12], hammer: [0, 0, 0.45], calendar: [-0.7, 0, 0] }, bodyY: 0.16 },
      { t: 1.0, pose: { body: [-0.2, 0, 0.02], armL: [-2.8, 0, 0.4], armR: [-2.8, 0, -0.4], bellL: [0, 0, -0.12], bellR: [0, 0, 0.12], hammer: [0, 0, -0.45], calendar: [-0.75, 0, 0] }, bodyY: 0.18 },
    ]),
    clip("attack", 0.6, [
      { t: 0, pose: { body: [-0.2, 0, 0], armL: [-2.8, 0, 0.4], armR: [-2.8, 0, -0.4], calendar: [-0.75, 0, 0] }, bodyY: 0.18 },
      { t: 0.12, pose: { body: [0.3, 0, 0], armL: [-0.35, 0, -0.1], armR: [-0.35, 0, 0.1], calendar: [0.6, 0, 0], legL: [0.2, 0, 0], legR: [0.2, 0, 0] }, bodyY: -0.2 },
      { t: 0.28, pose: { body: [0.24, 0, 0], armL: [-0.45, 0, 0], armR: [-0.45, 0, 0], calendar: [0.3, 0, 0] }, bodyY: -0.15 },
      { t: 0.6, pose: {} },
    ]),
    clip("hurt", 0.4, [
      { t: 0, pose: {} },
      { t: 0.07, pose: { body: [-0.22, 0.1, 0.1], armL: [-0.7, 0, 0.9], armR: [-0.7, 0, -0.9], bellL: [0, 0, 0.3], bellR: [0, 0, -0.3], calendar: [0.8, 0, 0] }, bodyY: 0.06, scale: 0.96 },
      { t: 0.2, pose: { body: [-0.06, 0, -0.03], calendar: [0.2, 0, 0] }, scale: 1.02 },
      { t: 0.4, pose: {}, scale: 1 },
    ]),
    clip("defeat", 1.8, [
      { t: 0, pose: {}, scale: 1 },
      { t: 0.3, pose: { body: [-0.3, 0.3, 0.25], armL: [-1.2, 0, 1.4], armR: [-1.2, 0, -1.4], bellL: [0, 0, 0.8], bellR: [0, 0, -0.8], hammer: [0, 0, 1.2], calendar: [1.2, 0, 0] }, bodyY: 0.1, scale: 0.97 },
      { t: 1.0, pose: { body: [0.9, 0.6, 0.7], armL: [0.6, 0, 1.6], armR: [0.6, 0, -1.6], bellL: [0, 0, 1.4], bellR: [0, 0, -1.4], hammer: [0, 0, 1.6], calendar: [1.6, 0, 0], legL: [1.0, 0, 0.3], legR: [1.0, 0, -0.3] }, bodyY: -0.7, scale: 0.75 },
      { t: 1.8, pose: { body: [1.5, 0.9, 1.0], armL: [1.0, 0, 1.7], armR: [1.0, 0, -1.7], bellL: [0, 0, 1.6], bellR: [0, 0, -1.6], hammer: [0, 0, 1.8], calendar: [1.9, 0, 0], legL: [1.4, 0, 0.4], legR: [1.4, 0, -0.4] }, bodyY: -1.1, scale: 0.45 },
    ]),
  ];
}

export function paintFinalAtlas(): Raster {
  const P = FINAL.palette;
  const r = new Raster(FINAL.atlasSize, hex(P.face));
  const ink = hex(P.ink);
  const red = hex(P.red);
  r.paint(FINAL_CELLS.crimson, (u, v) => shade(mixColor(hex(P.crimson), hex(P.crimsonLight), Math.exp(-Math.pow((v - 0.3) / 0.18, 2)) * 0.6), 0.94 + pfbm(u, v, 4, 2, 51) * 0.08));
  r.paint(FINAL_CELLS.brass, (u, v) => shade(hex(P.brass), 0.76 + 0.42 * Math.exp(-Math.pow((v - 0.35) / 0.18, 2))));
  r.paint(FINAL_CELLS.iron, (u, v) => shade(hex(P.iron), 0.9 + pfbm(u, v, 4, 2, 53) * 0.15));
  r.paint(FINAL_CELLS.blade, (u, v) => shade(hex(P.ink), u > 0.85 || u < 0.15 ? 1.9 : 1.1 + pfbm(u, v, 4, 2, 55) * 0.2));
  r.paint(FINAL_CELLS.page, (u, v) => shade(hex(P.paper), Math.abs(((v * 30) % 1) - 0.5) < 0.1 ? 0.88 : 1));
  r.paint(FINAL_CELLS.red, () => red);
  // Calendar sheet: red header band, a 7×5 date grid, the due date circled and crossed.
  const K = FINAL_CELLS.calendar;
  r.paint(K, (u, v) => (v < 0.24 ? hex(P.red) : hex(P.paper)));
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      const x = K.x + 18 + col * 32;
      const y = K.y + 42 + row * 16;
      if (row === 3 && col === 5) continue;
      r.stroke([[x, y], [x + 10, y]], 4, 4, hex(P.ink, row * 7 + col < 24 ? 0.35 : 0.85));
      if (row * 7 + col < 24) r.stroke([[x - 2, y + 4], [x + 12, y - 4]], 2, 2, red);
    }
  }
  r.ellipse(K.x + 18 + 5 * 32 + 5, K.y + 42 + 3 * 16, 15, 11, red, 0, 1);
  r.ellipse(K.x + 18 + 5 * 32 + 5, K.y + 42 + 3 * 16, 11, 7.5, hex(P.paper), 0, 1);
  r.stroke([[K.x + 18 + 5 * 32 - 2, K.y + 42 + 3 * 16], [K.x + 18 + 5 * 32 + 12, K.y + 42 + 3 * 16]], 4, 4, ink);
  for (let k = 0; k < 4; k++) r.stroke([[K.x + 70 + k * 30, K.y + 14], [K.x + 84 + k * 30, K.y + 14]], 6, 6, hex(P.paper));
  // Clock face: hour blocks and an angry face.
  const F = FINAL_CELLS.face;
  const cx = F.x + F.w / 2;
  const cy = F.y + F.h / 2;
  r.paint(F, (u, v) => shade(hex(P.face), 1 - Math.hypot(u - 0.5, v - 0.5) * 0.18));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const r0 = k % 3 ? 100 : 92;
    r.stroke([[cx + Math.sin(a) * r0, cy - Math.cos(a) * r0], [cx + Math.sin(a) * 116, cy - Math.cos(a) * 116]], k % 3 ? 7 : 12, k % 3 ? 7 : 12, ink);
  }
  for (const side of [-1, 1]) {
    const ex = cx + side * 44;
    const ey = cy - 12;
    r.ellipse(ex, ey, 26, 22, hex("#fff8ea"), 0, 1.5);
    r.ellipse(ex - side * 4, ey + 4, 14, 15, hex(P.red), 0, 1);
    r.ellipse(ex - side * 4, ey + 4, 7, 9, hex("#170c10"), 0, 1);
    r.ellipse(ex + 4, ey - 4, 4, 4, hex("#ffffff"), 0, 1);
    r.stroke([[ex - side * 34, ey - 34], [ex + side * 26, ey - 18]], 12, 8, ink);
  }
  const mouth: [number, number][] = [];
  for (let k = 0; k <= 10; k++) mouth.push([cx - 50 + k * 10, cy + 50 + (k % 2 ? -10 : 0)]);
  r.stroke(mouth, 7, 7, ink);
  // Clock hands stuck at one minute to midnight.
  r.stroke([[cx, cy], [cx - 6, cy - 86]], 9, 5, ink);
  r.stroke([[cx, cy], [cx - 4, cy - 64]], 12, 7, ink);
  r.ellipse(cx, cy, 10, 10, hex(P.brass), 0, 1);
  void ([] as V3[]);
  return r;
}
