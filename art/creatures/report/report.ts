/**
 * 分組報告聚合體 — a group report that grew legs.
 *
 * A wide ring binder whose lid opens like a jaw over a stack of pages and
 * the binder rings (its teeth), a sticky-note tab for every group member,
 * rolled-report arms ending in paper-clip claws, and stubby legs of paper
 * reams. The face is printed on the binder's front: reinforcement-ring
 * eyes and marker brows. Wide and heavy, so it never reads as the quiz.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PartBuilder, type V3 } from "../../shared/builder.ts";
import { sweep } from "../../shared/loft.ts";
import { Raster, hex, mixColor, pfbm, shade } from "../../shared/raster.ts";
import { creatureCell as cell, creatureClip, creatureRig, loopKeys, type CreatureKey } from "../shared/creature.ts";

export const REPORT = {
  id: "creature.report",
  version: 1,
  atlasSize: 512,
  palette: { plastic: "#4f4f8f", plasticLight: "#7a78b8", paper: "#f4ecd8", ink: "#24233a", red: "#c8414b", kraft: "#c7a77a", metal: "#c9ccd2" },
  bones: [
    { name: "root", parent: null, offset: [0, 0, 0] },
    { name: "body", parent: "root", offset: [0, 0.5, 0] },
    { name: "lid", parent: "body", offset: [0, 0.6, -0.4] },
    { name: "tabs", parent: "body", offset: [0, 0.6, 0.38] },
    { name: "armL", parent: "body", offset: [0.62, 0.42, 0.02] },
    { name: "armR", parent: "body", offset: [-0.62, 0.42, 0.02] },
    { name: "legL", parent: "root", offset: [0.3, 0.5, 0] },
    { name: "legR", parent: "root", offset: [-0.3, 0.5, 0] },
  ],
} as const;

export const REPORT_CELLS = {
  front: cell(0, 0, 2, 2),
  plastic: cell(2, 0),
  edges: cell(3, 0),
  page: cell(2, 1),
  roll: cell(3, 1),
  metal: cell(0, 2),
  ream: cell(1, 2),
  noteY: cell(2, 2),
  noteP: cell(3, 2),
  noteG: cell(0, 3),
  noteB: cell(1, 3),
  label: cell(2, 3),
} as const;

export function buildReport() {
  const r = creatureRig(REPORT.bones);
  const b = new PartBuilder(REPORT.atlasSize);
  const body = r.at("body");
  const i = r.index;
  // Binder base: the lower half of the binder, front face printed with the face.
  const base = new RoundedBoxGeometry(1.18, 0.62, 0.84, 3, 0.06);
  base.translate(body.x, body.y + 0.29, body.z);
  b.add(base, { name: "binder-base", color: "#ffffff", tile: REPORT_CELLS.plastic, skin: i("body") });
  const face = new THREE.PlaneGeometry(1.08, 0.54, 4, 2);
  face.translate(body.x, body.y + 0.3, body.z + 0.424);
  b.add(face, { name: "binder-face", color: "#ffffff", tile: REPORT_CELLS.front, skin: i("body") });
  // Page stack inside (edges show between base and lid) and the binder rings.
  const pages = new THREE.BoxGeometry(1.04, 0.16, 0.74);
  pages.translate(body.x, body.y + 0.64, body.z + 0.02);
  b.add(pages, { name: "pages", color: "#ffffff", tile: REPORT_CELLS.edges, skin: i("body") });
  for (let k = 0; k < 3; k++) {
    const ring = new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI);
    ring.rotateY(Math.PI / 2);
    ring.translate(body.x - 0.34 + k * 0.34, body.y + 0.7, body.z - 0.32);
    b.add(ring, { name: "binder-ring", color: "#ffffff", tile: REPORT_CELLS.metal, skin: i("body") });
  }
  // Lid hinged at the back: opens upward like a jaw.
  const lid = new RoundedBoxGeometry(1.2, 0.08, 0.86, 2, 0.035);
  lid.translate(body.x, body.y + 0.74, body.z + 0.02);
  b.add(lid, { name: "binder-lid", color: "#ffffff", tile: REPORT_CELLS.plastic, skin: i("lid") });
  const spine = new THREE.CylinderGeometry(0.07, 0.07, 1.2, 10, 1, false, Math.PI, Math.PI);
  spine.rotateZ(Math.PI / 2);
  spine.translate(body.x, body.y + 0.7, body.z - 0.42);
  b.add(spine, { name: "binder-spine", color: "#ffffff", tile: REPORT_CELLS.plastic, skin: i("lid") });
  const label = new THREE.PlaneGeometry(0.42, 0.26);
  label.rotateX(-Math.PI / 2);
  label.translate(body.x, body.y + 0.785, body.z + 0.05);
  b.add(label, { name: "lid-label", color: "#ffffff", tile: REPORT_CELLS.label, skin: i("lid") });
  // One sticky-note tab per group member, poking out of the pages at the front.
  const notes = [REPORT_CELLS.noteY, REPORT_CELLS.noteP, REPORT_CELLS.noteG, REPORT_CELLS.noteB];
  for (let k = 0; k < 4; k++) {
    const tab = new THREE.BoxGeometry(0.16, 0.12, 0.012);
    tab.rotateX(-0.35 + (k % 2) * 0.2);
    tab.translate(body.x - 0.39 + k * 0.26, body.y + 0.7 + (k % 2) * 0.03, body.z + 0.42);
    b.add(tab, { name: "sticky-tab", color: "#ffffff", tile: notes[k], skin: i("tabs") });
  }
  // Rolled-report arms with paper-clip claws.
  for (const side of [1, -1] as const) {
    const bone = side > 0 ? "armL" : "armR";
    const s = r.at(bone);
    const dir = new THREE.Vector3(side * 0.3, -1, 0.25).normalize();
    const roll = new THREE.CylinderGeometry(0.11, 0.1, 0.62, 12, 1);
    roll.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    roll.translate(s.x + dir.x * 0.3, s.y + dir.y * 0.3, s.z + dir.z * 0.3);
    b.add(roll, { name: "report-roll", color: "#ffffff", tile: REPORT_CELLS.roll, skin: i(bone) });
    const shoulder = new THREE.SphereGeometry(0.15, 12, 8);
    shoulder.translate(s.x, s.y, s.z);
    b.add(shoulder, { name: "shoulder", color: "#ffffff", tile: REPORT_CELLS.plastic, skin: i(bone) });
    const hand = new THREE.Vector3(s.x + dir.x * 0.64, s.y + dir.y * 0.64, s.z + dir.z * 0.64);
    for (const prong of [-1, 1]) {
      const clip = sweep(
        [
          [hand.x, hand.y + 0.04, hand.z],
          [hand.x + prong * 0.08, hand.y - 0.06, hand.z + 0.06],
          [hand.x + prong * 0.06, hand.y - 0.2, hand.z + 0.12],
          [hand.x + prong * 0.02, hand.y - 0.24, hand.z + 0.08],
        ],
        { width: () => 0.018, thickness: () => 0.018, outward: [0, 0, 1], segments: 10, around: 6 },
      );
      b.add(clip.geometry, { name: "clip-claw", color: "#ffffff", tile: REPORT_CELLS.metal, skin: i(bone) });
    }
  }
  // Ream legs.
  for (const side of [1, -1] as const) {
    const bone = side > 0 ? "legL" : "legR";
    const l = r.at(bone);
    for (let k = 0; k < 3; k++) {
      const ream = new RoundedBoxGeometry(0.32 - k * 0.02, 0.15, 0.4 - k * 0.03, 1, 0.02);
      ream.rotateY((k - 1) * 0.08);
      ream.translate(l.x, 0.08 + k * 0.155, l.z);
      b.add(ream, { name: "ream", color: "#ffffff", tile: REPORT_CELLS.ream, skin: i(bone) });
    }
  }
  const geometry = b.build();
  const material = new THREE.MeshStandardMaterial({ name: "report-atlas", vertexColors: true, roughness: 0.62 });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "report";
  mesh.add(r.root);
  mesh.bind(r.skeleton);
  const scene = new THREE.Group();
  scene.name = "creature-report";
  scene.add(mesh);
  scene.userData = { artId: REPORT.id, artVersion: REPORT.version, labelHeight: 1.75 };
  return { scene, clips: reportClips(), atlasPng: paintReportAtlas().toPNG(), parts: b.parts, triangles: b.triangleCount, bones: r.names };
}

function reportClips() {
  const base = REPORT.bones[1].offset[1];
  const clip = (name: string, duration: number, keys: CreatureKey[]) => creatureClip(name, duration, keys, { bone: "body", base });
  const walk = (period: number, amp: number, lean: number) =>
    loopKeys(period, 8, (p) => ({
      pose: {
        body: [lean, 0, Math.sin(p) * amp * 0.5],
        lid: [-0.06 - Math.max(0, Math.sin(p * 2)) * amp * 0.6, 0, 0],
        tabs: [Math.sin(p * 2) * amp, 0, 0],
        armL: [Math.sin(p) * amp * 2.2, 0, 0.18],
        armR: [-Math.sin(p) * amp * 2.2, 0, -0.18],
        legL: [-Math.sin(p) * amp * 2.5, 0, 0],
        legR: [Math.sin(p) * amp * 2.5, 0, 0],
      },
      bodyY: Math.abs(Math.cos(p)) * amp * 0.4,
    }));
  return [
    clip("idle", 2.6, walk(2.6, 0.06, 0)),
    clip("chase", 0.9, walk(0.9, 0.16, 0.12)),
    clip("windup", 1.0, [
      { t: 0, pose: {} },
      { t: 0.4, pose: { body: [-0.1, 0, 0], lid: [-0.7, 0, 0], tabs: [-0.4, 0, 0], armL: [-1.6, 0, 0.5], armR: [-1.6, 0, -0.5] }, bodyY: 0.06 },
      { t: 0.88, pose: { body: [-0.2, 0, 0], lid: [-1.15, 0, 0], tabs: [-0.7, 0, 0], armL: [-2.7, 0, 0.35], armR: [-2.7, 0, -0.35] }, bodyY: 0.14 },
      { t: 0.94, pose: { body: [-0.22, 0, 0.03], lid: [-1.2, 0, 0], tabs: [-0.75, 0, 0], armL: [-2.75, 0, 0.32], armR: [-2.75, 0, -0.32] }, bodyY: 0.14 },
      { t: 1.0, pose: { body: [-0.2, 0, -0.03], lid: [-1.15, 0, 0], tabs: [-0.7, 0, 0], armL: [-2.7, 0, 0.35], armR: [-2.7, 0, -0.35] }, bodyY: 0.14 },
    ]),
    clip("attack", 0.5, [
      { t: 0, pose: { body: [-0.2, 0, 0], lid: [-1.15, 0, 0], tabs: [-0.7, 0, 0], armL: [-2.7, 0, 0.35], armR: [-2.7, 0, -0.35] }, bodyY: 0.14 },
      { t: 0.09, pose: { body: [0.32, 0, 0], lid: [0.05, 0, 0], tabs: [0.5, 0, 0], armL: [-0.55, 0, 0.1], armR: [-0.55, 0, -0.1], legL: [0.2, 0, 0], legR: [0.2, 0, 0] }, bodyY: -0.12 },
      { t: 0.2, pose: { body: [0.25, 0, 0], lid: [-0.12, 0, 0], tabs: [0.3, 0, 0], armL: [-0.6, 0, 0.15], armR: [-0.6, 0, -0.15] }, bodyY: -0.08 },
      { t: 0.5, pose: {} },
    ]),
    clip("hurt", 0.36, [
      { t: 0, pose: {} },
      { t: 0.06, pose: { body: [-0.28, 0, 0.1], lid: [-0.5, 0, 0], tabs: [0.6, 0, 0], armL: [-0.6, 0, 0.9], armR: [-0.6, 0, -0.9] }, bodyY: 0.05, scale: 0.94 },
      { t: 0.16, pose: { body: [-0.08, 0, -0.04], lid: [-0.15, 0, 0] }, scale: 1.02 },
      { t: 0.36, pose: {}, scale: 1 },
    ]),
    clip("defeat", 1.4, [
      { t: 0, pose: {}, scale: 1 },
      { t: 0.2, pose: { body: [-0.3, 0.2, 0.2], lid: [-1.6, 0, 0], tabs: [0.9, 0, 0], armL: [-1.2, 0, 1.3], armR: [-1.2, 0, -1.3] }, bodyY: 0.08, scale: 0.95 },
      { t: 0.7, pose: { body: [0.6, 0.6, 0.5], lid: [-2.2, 0, 0], tabs: [1.2, 0, 0], armL: [0.4, 0, 1.5], armR: [0.4, 0, -1.5], legL: [0.8, 0, 0.3], legR: [0.8, 0, -0.3] }, bodyY: -0.3, scale: 0.7 },
      { t: 1.4, pose: { body: [1.3, 0.9, 0.7], lid: [-2.6, 0, 0], tabs: [1.4, 0, 0], armL: [0.9, 0, 1.6], armR: [0.9, 0, -1.6], legL: [1.2, 0, 0.4], legR: [1.2, 0, -0.4] }, bodyY: -0.5, scale: 0.4 },
    ]),
  ];
}

export function paintReportAtlas(): Raster {
  const P = REPORT.palette;
  const r = new Raster(REPORT.atlasSize, hex(P.paper));
  const plastic = hex(P.plastic);
  const light = hex(P.plasticLight);
  const ink = hex(P.ink);
  const red = hex(P.red);
  const paper = hex(P.paper);
  r.paint(REPORT_CELLS.plastic, (u, v) => shade(mixColor(plastic, light, Math.exp(-Math.pow((v - 0.25) / 0.2, 2)) * 0.5), 0.94 + pfbm(u, v, 4, 2, 3) * 0.08));
  r.paint(REPORT_CELLS.edges, (u, v) => shade(paper, Math.abs(((v * 40) % 1) - 0.5) < 0.12 ? 0.82 : 1));
  r.paint(REPORT_CELLS.roll, (u, v) => shade(paper, Math.abs((((u + v * 0.4) * 9) % 1) - 0.5) < 0.05 ? 0.7 : 0.97 + pfbm(u, v, 4, 2, 7) * 0.05));
  r.paint(REPORT_CELLS.metal, (u, v) => shade(hex(P.metal), 0.75 + 0.45 * Math.exp(-Math.pow((v - 0.35) / 0.18, 2))));
  r.paint(REPORT_CELLS.ream, (u, v) => (v > 0.38 && v < 0.62 ? shade(hex("#ece5d6"), 1) : shade(hex(P.kraft), 0.92 + pfbm(u, v, 4, 2, 11) * 0.1)));
  for (const [c, col] of [
    [REPORT_CELLS.noteY, "#f4d35e"],
    [REPORT_CELLS.noteP, "#f2a0b4"],
    [REPORT_CELLS.noteG, "#9fd8a6"],
    [REPORT_CELLS.noteB, "#9cc4ef"],
  ] as const) {
    r.paint(c, (u, v) => shade(hex(col), v < 0.2 ? 0.88 : 1));
  }
  // Lid label: title bar, member name lines, a red due date.
  r.paint(REPORT_CELLS.label, (u, v) => (u > 0.06 && u < 0.94 && v > 0.08 && v < 0.92 ? hex("#fbf6ea") : hex(P.plastic)));
  const L = REPORT_CELLS.label;
  for (let k = 0; k < 4; k++) r.stroke([[L.x + 24, L.y + 34 + k * 18], [L.x + 24 + (k ? 62 : 82), L.y + 34 + k * 18]], k ? 3 : 6, k ? 3 : 6, k === 3 ? red : ink);
  // Page cell: a bar chart and a pie chart.
  r.paint(REPORT_CELLS.page, () => paper);
  const pg = REPORT_CELLS.page;
  for (let k = 0; k < 4; k++) {
    const h = [40, 62, 30, 78][k];
    for (let y = pg.y + 108 - h; y < pg.y + 108; y++) for (let x = pg.x + 16 + k * 18; x < pg.x + 28 + k * 18; x++) r.blend(x, y, hex(["#7a78b8", "#c8414b", "#f4d35e", "#6a9e86"][k]), 1);
  }
  r.ellipse(pg.x + 104, pg.y + 40, 16, 16, hex("#7a78b8"), 0, 1);
  r.stroke([[pg.x + 104, pg.y + 40], [pg.x + 104, pg.y + 24]], 2, 2, paper);
  r.stroke([[pg.x + 104, pg.y + 40], [pg.x + 118, pg.y + 46]], 2, 2, paper);
  // Front: binder plastic with a face — reinforcement-ring eyes and marker brows.
  r.paint(REPORT_CELLS.front, (u, v) => shade(mixColor(plastic, light, Math.exp(-Math.pow((v - 0.2) / 0.25, 2)) * 0.45), 0.94 + pfbm(u, v, 4, 2, 5) * 0.08));
  const F = REPORT_CELLS.front;
  const px = (u: number, v: number): [number, number] => [F.x + 3 + u * (F.w - 6), F.y + 3 + (1 - v) * (F.h - 6)];
  for (const side of [-1, 1]) {
    const [ex, ey] = px(0.5 + side * 0.2, 0.55);
    r.ellipse(ex, ey, 30, 30, hex("#fbf8ee"), 0, 1.5);
    r.ellipse(ex, ey, 13, 13, plastic, 0, 1);
    r.ellipse(ex - side * 3, ey + 3, 9, 11, hex("#121022"), 0, 1);
    r.ellipse(ex + 4, ey - 4, 3.5, 3.5, hex("#ffffff"), 0, 1);
    const [bx, by] = px(0.5 + side * 0.2, 0.83);
    r.stroke([[bx - side * 36, by + 12], [bx + side * 30, by - 8]], 11, 7, ink);
  }
  // Group member initials as coloured dots along the bottom edge.
  for (let k = 0; k < 4; k++) {
    const [dx, dy] = px(0.26 + k * 0.16, 0.16);
    r.ellipse(dx, dy, 9, 9, hex(["#f4d35e", "#f2a0b4", "#9fd8a6", "#9cc4ef"][k]), 0, 1);
  }
  void ([] as V3[]);
  return r;
}
