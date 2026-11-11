/**
 * NPC kit parts. Every part is authored on the student kit skeleton in bind
 * space, so any combination shares one rig and one set of clips. Colours come
 * from tint slots (stored in vertex alpha) that each roster preset fills.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { chainBlend, jointBlend, smoothstep, type PartBuilder, type SkinFn, type V3 } from "../../shared/builder.ts";
import { hring, limbRing, loft, sweep, dome, type Ring } from "../../shared/loft.ts";
import { addHand, addHead, addShoe, paramAt, torsoSkin } from "../student-kit/body.ts";
import { headPoint, skullCenter } from "../student-kit/hair.ts";
import type { KitRig } from "../student-kit/skeleton.ts";
import { NPC_CELLS, npcSwatch } from "./atlas.ts";

/** Tint slots; the runtime multiplies vertex colour by the preset's colour for the slot. */
export const SLOT = {
  skin: 1,
  hair: 2,
  top: 3,
  top2: 4,
  bottom: 5,
  socks: 6,
  shoe: 7,
  shoeAccent: 8,
  acc: 9,
  acc2: 10,
  stripe: 11,
} as const;

export type PartDef = { id: string; slot: string; build: (b: PartBuilder, rig: KitRig) => void };

const DEG = Math.PI / 180;
const FRONT = Math.PI / 2;
const white = new THREE.Color(1, 1, 1);
const tone = (k: number) => white.clone().multiplyScalar(k).getStyle();

// ---------------------------------------------------------------- base

function head(face: "faceA" | "faceB") {
  return (b: PartBuilder, rig: KitRig) => {
    b.slot = SLOT.skin;
    addHead(b, rig, { face: NPC_CELLS[face], skin: NPC_CELLS.skin });
    for (const side of [1, -1] as const) addHand(b, rig, side, NPC_CELLS.skin);
  };
}

/** Upper arm and forearm in skin, for short sleeves. */
function bareArms(b: PartBuilder, rig: KitRig) {
  for (const side of [1, -1] as const) {
    const L = side > 0 ? "L" : "R";
    const X = (x: number) => x * side;
    const fwd: V3 = [0, 0, 1];
    const centers: V3[] = [[X(0.15), 1.205, -0.005], [X(0.177), 1.12, -0.005], rig.at(`lowerArm${L}`).toArray() as V3, [X(0.212), 0.86, 0.005], rig.p(`hand${L}`, [0, 0.008, 0])];
    const radii = [0.05, 0.045, 0.04, 0.036, 0.031];
    const arm = loft(
      centers.map((c, i) => limbRing(c, [X(0.12), -1, i > 1 ? 0.07 : 0], fwd, radii[i], radii[i] * 0.97)),
      { segments: 10 },
    );
    b.add(arm.geometry, {
      name: "bare-arm",
      color: "#ffffff",
      tile: NPC_CELLS.skin,
      slot: SLOT.skin,
      skin: chainBlend([rig.index("chest"), rig.index(`upperArm${L}`), rig.index(`lowerArm${L}`), rig.index(`hand${L}`)], [0.05, paramAt(centers, 2), 0.95], 0.06),
    });
  }
}

/** Thigh to ankle in skin, for skirts. */
function bareLegs(b: PartBuilder, rig: KitRig) {
  for (const side of [1, -1] as const) {
    const L = side > 0 ? "L" : "R";
    const knee = rig.at(`lowerLeg${L}`);
    const ankle = rig.at(`foot${L}`);
    const rings: [number, number, number, number][] = [
      [0.78, 0.072, 0.074, 0],
      [0.62, 0.064, 0.066, 0],
      [0.48, 0.054, 0.057, 0.002],
      [knee.y, 0.05, 0.053, 0.005],
      [0.31, 0.051, 0.056, -0.006],
      [0.18, 0.038, 0.041, -0.008],
      [0.1, 0.033, 0.035, -0.01],
    ];
    const leg = loft(rings.map(([y, rx, rz, z]) => hring([side * 0.09, y, z], rx, rz)), { segments: 10 });
    const top = rings[0][0];
    const bottom = rings[rings.length - 1][0];
    b.add(leg.geometry, {
      name: "bare-leg",
      color: "#ffffff",
      tile: NPC_CELLS.skin,
      slot: SLOT.skin,
      skin: chainBlend(
        [rig.index("hips"), rig.index(`upperLeg${L}`), rig.index(`lowerLeg${L}`), rig.index(`foot${L}`)],
        [0.06, (top - knee.y) / (top - bottom), (top - ankle.y) / (top - bottom)],
        0.06,
      ),
    });
  }
}

// ---------------------------------------------------------------- tops

/** Long or short sleeve along the arm, with an optional cuff band. */
function sleeve(
  b: PartBuilder,
  rig: KitRig,
  side: 1 | -1,
  o: { scale: number; endY: number; tile: typeof NPC_CELLS.knit; slot: number; cuff?: number; shade?: number },
) {
  const L = side > 0 ? "L" : "R";
  const X = (x: number) => x * side;
  const fwd: V3 = [0, 0, 1];
  const all: { c: V3; d: V3; r: number }[] = [
    { c: [X(0.118), 1.214, -0.005], d: [X(1), -0.15, 0], r: 0.07 },
    { c: [X(0.158), 1.206, -0.005], d: [X(0.55), -1, 0], r: 0.069 },
    { c: [X(0.177), 1.12, -0.005], d: [X(0.15), -1, 0], r: 0.062 },
    { c: [X(0.19), 1.04, -0.005], d: [X(0.15), -1, 0], r: 0.058 },
    { c: rig.at(`lowerArm${L}`).toArray() as V3, d: [X(0.11), -1, 0.02], r: 0.055 },
    { c: [X(0.207), 0.92, 0.002], d: [X(0.1), -1, 0.06], r: 0.05 },
    { c: [X(0.214), 0.855, 0.006], d: [X(0.08), -1, 0.08], r: 0.046 },
    { c: [X(0.219), 0.8, 0.01], d: [X(0.08), -1, 0.08], r: 0.043 },
  ];
  const path = all.filter((p) => p.c[1] >= o.endY - 1e-6);
  const rings = path.map((p) => limbRing(p.c, p.d, fwd, p.r * o.scale, p.r * o.scale * 0.97));
  const lofted = loft(rings, { segments: 10, thickness: 0.007 });
  const elbow = path.findIndex((p) => p.c[1] < 1.0);
  const centers = path.map((p) => p.c);
  const tElbow = elbow > 0 ? paramAt(centers, elbow) : 1.2;
  b.add(lofted.geometry, {
    name: "sleeve",
    color: (_p, t, _u, shell) => white.clone().multiplyScalar((shell === 1 ? 0.72 : 1) * (o.shade ?? 1) * (0.86 + 0.14 * smoothstep(0, 0.08, t))),
    tile: o.tile,
    slot: o.slot,
    skin: chainBlend([rig.index("chest"), rig.index(`upperArm${L}`), rig.index(`lowerArm${L}`)], [paramAt(centers, 1), tElbow], 0.09),
  });
  if (o.cuff) {
    const end = path[path.length - 1];
    const cuff = loft(
      [0.022, 0.0, -0.004].map((dy) =>
        limbRing([end.c[0], end.c[1] + dy, end.c[2]], end.d, fwd, end.r * o.scale * o.cuff!, end.r * o.scale * o.cuff! * 0.97),
      ),
      { segments: 12, thickness: 0.006 },
    );
    b.add(cuff.geometry, { name: "cuff", color: tone(0.88), tile: NPC_CELLS.knit, slot: o.slot, skin: rig.index(`lowerArm${L}`) });
  }
}

type TorsoRing = [number, number, number, number];
function shell(b: PartBuilder, rig: KitRig, name: string, rings: TorsoRing[], o: { tile: typeof NPC_CELLS.knit; slot: number; thickness: number; gap?: (y: number) => number; shade?: number; segments?: number }) {
  const lofted = loft(
    rings.map(([y, rx, rz, z]) => {
      const g = o.gap?.(y);
      return hring([0, y, z], rx, rz, g ? { arc: [FRONT + g, FRONT + Math.PI * 2 - g] } : {});
    }),
    { segments: o.segments ?? 16, thickness: o.thickness },
  );
  b.add(lofted.geometry, {
    name,
    color: (_p, _t, _u, sh) => white.clone().multiplyScalar((sh === 1 ? 0.72 : sh === 0.5 ? 0.86 : 1) * (o.shade ?? 1)),
    tile: o.tile,
    slot: o.slot,
    skin: torsoSkin(rig),
  });
}

const SHIRT: TorsoRing[] = [
  [0.86, 0.156, 0.108, 0.004],
  [0.92, 0.15, 0.102, 0.004],
  [0.98, 0.142, 0.097, 0.005],
  [1.04, 0.146, 0.1, 0.007],
  [1.1, 0.156, 0.106, 0.008],
  [1.155, 0.163, 0.105, 0.006],
  [1.2, 0.167, 0.099, 0.0],
  [1.232, 0.15, 0.09, -0.003],
  [1.255, 0.102, 0.077, -0.001],
  [1.27, 0.064, 0.06, 0.004],
];
const grow = (rings: TorsoRing[], k: number, add: number): TorsoRing[] => rings.map(([y, rx, rz, z]) => [y, rx * k + add, rz * k + add, z]);

function hoodie(b: PartBuilder, rig: KitRig) {
  const body: TorsoRing[] = [[0.79, 0.168, 0.12, 0.002], ...grow(SHIRT, 1.08, 0.004)];
  shell(b, rig, "hoodie", body, { tile: NPC_CELLS.knit, slot: SLOT.top, thickness: 0.009 });
  const hem = loft([0.78, 0.8, 0.822].map((y) => hring([0, y, 0.002], 0.164, 0.117)), { segments: 22, thickness: 0.006 });
  b.add(hem.geometry, { name: "hoodie-hem", color: tone(0.86), tile: NPC_CELLS.knit, slot: SLOT.top, skin: rig.index("hips") });
  const pocket = new RoundedBoxGeometry(0.21, 0.12, 0.016, 2, 0.008);
  pocket.translate(0, 0.925, 0.124);
  b.add(pocket, { name: "kangaroo-pocket", color: tone(0.92), tile: NPC_CELLS.knit, slot: SLOT.top, skin: torsoSkin(rig) });
  // Hood: a rolled lip round the back of the neck and the fabric lying on the back.
  const lip = new THREE.TorusGeometry(0.112, 0.036, 8, 20, Math.PI * 1.25);
  lip.rotateX(Math.PI / 2);
  lip.rotateY(Math.PI * 0.375 + Math.PI);
  lip.translate(0, 1.262, -0.012);
  b.add(lip, { name: "hood-lip", color: tone(0.94), tile: NPC_CELLS.knit, slot: SLOT.top, skin: rig.index("chest") });
  const back = new THREE.SphereGeometry(1, 14, 10);
  back.scale(0.13, 0.12, 0.045);
  back.translate(0, 1.19, -0.135);
  b.add(back, { name: "hood", color: tone(0.9), tile: NPC_CELLS.knit, slot: SLOT.top, skin: rig.index("chest") });
  for (const s of [-1, 1]) {
    const cord = sweep([[s * 0.035, 1.262, 0.098], [s * 0.04, 1.2, 0.121], [s * 0.042, 1.13, 0.128]], { width: () => 0.003, thickness: () => 0.003, outward: [0, 0, 1], segments: 5, around: 5 });
    b.add(cord.geometry, { name: "drawstring", color: "#ffffff", tile: npcSwatch("lace"), slot: SLOT.top2, skin: rig.index("chest") });
  }
  for (const side of [1, -1] as const) sleeve(b, rig, side, { scale: 1.12, endY: 0.8, tile: NPC_CELLS.knit, slot: SLOT.top, cuff: 1.04 });
}

function cardigan(b: PartBuilder, rig: KitRig) {
  shell(b, rig, "blouse", SHIRT, { tile: NPC_CELLS.knit, slot: SLOT.top2, thickness: 0.004 });
  // Rounded "Peter Pan" collar flaps on the blouse.
  for (const s of [-1, 1]) {
    const flap = new THREE.CircleGeometry(0.045, 12, Math.PI, Math.PI);
    flap.scale(1, 0.75, 1);
    flap.rotateX(-1.15);
    flap.rotateY(s * 0.42);
    flap.translate(s * 0.034, 1.262, 0.064);
    b.add(flap, { name: "collar", color: "#ffffff", tile: NPC_CELLS.knit, slot: SLOT.top2, skin: rig.index("chest") });
  }
  const knit: TorsoRing[] = [[0.8, 0.168, 0.118, 0.003], ...grow(SHIRT.slice(0, 8), 1.06, 0.006), [1.255, 0.116, 0.09, -0.002]];
  // V-neck: wide at the top, buttoned closed below the chest.
  const gap = (y: number) => (y < 1.0 ? 0.16 : y < 1.1 ? 0.26 : 0.26 + (y - 1.1) * 3.4);
  shell(b, rig, "cardigan", knit, { tile: NPC_CELLS.knit, slot: SLOT.top, thickness: 0.009, gap });
  const rib = loft([0.79, 0.805, 0.822].map((y) => hring([0, y, 0.003], 0.172, 0.121, { arc: [FRONT + 0.16, FRONT + Math.PI * 2 - 0.16] })), { segments: 20, thickness: 0.006 });
  b.add(rib.geometry, { name: "cardigan-rib", color: tone(0.86), tile: NPC_CELLS.knit, slot: SLOT.top, skin: rig.index("hips") });
  for (let i = 0; i < 4; i++) {
    const y = 0.86 + i * 0.07;
    const g = gap(y) + 0.04;
    const btn = new THREE.CylinderGeometry(0.008, 0.008, 0.004, 8);
    btn.rotateX(Math.PI / 2);
    btn.translate(Math.cos(FRONT + g) * 0.165, y, Math.sin(FRONT + g) * 0.118 + 0.006);
    b.add(btn, { name: "button", color: "#ffffff", tile: npcSwatch("gold"), slot: 255, skin: torsoSkin(rig) });
  }
  for (const side of [1, -1] as const) sleeve(b, rig, side, { scale: 1.06, endY: 0.8, tile: NPC_CELLS.knit, slot: SLOT.top, cuff: 1.05 });
}

function track(b: PartBuilder, rig: KitRig) {
  const body: TorsoRing[] = [[0.8, 0.164, 0.116, 0.002], ...grow(SHIRT, 1.04, 0.004)];
  shell(b, rig, "track-jacket", body, { tile: NPC_CELLS.knit, slot: SLOT.top, thickness: 0.008 });
  const collar = loft([1.25, 1.285, 1.318].map((y, i) => hring([0, y, 0.004], 0.078 - i * 0.004, 0.071 - i * 0.004)), { segments: 18, thickness: 0.006 });
  b.add(collar.geometry, { name: "stand-collar", color: tone(0.94), tile: NPC_CELLS.knit, slot: SLOT.top, skin: chainBlend([rig.index("chest"), rig.index("neck")], [0.5], 0.4) });
  const zip = new THREE.BoxGeometry(0.012, 0.47, 0.006);
  zip.translate(0, 1.07, 0.116);
  b.add(zip, { name: "zip", color: "#ffffff", tile: npcSwatch("zip"), slot: 255, skin: torsoSkin(rig) });
  const hem = loft([0.785, 0.8, 0.815].map((y) => hring([0, y, 0.002], 0.16, 0.113)), { segments: 20, thickness: 0.006 });
  b.add(hem.geometry, { name: "track-hem", color: tone(0.82), tile: NPC_CELLS.knit, slot: SLOT.top, skin: rig.index("hips") });
  for (const side of [1, -1] as const) {
    sleeve(b, rig, side, { scale: 1.04, endY: 0.8, tile: NPC_CELLS.knit, slot: SLOT.top, cuff: 0.98 });
    // Two stripes down the outside of the sleeve.
    const L = side > 0 ? "L" : "R";
    for (const off of [-0.012, 0.012]) {
      const path: V3[] = [[side * 0.205, 1.215, off], [side * 0.235, 1.12, off], [side * 0.255, 0.985, off], [side * 0.262, 0.86, off + 0.01], [side * 0.264, 0.81, off + 0.012]];
      const stripe = sweep(path, { width: () => 0.006, thickness: () => 0.0015, outward: [side, 0, 0], segments: 12, around: 4 });
      b.add(stripe.geometry, {
        name: "sleeve-stripe",
        color: "#ffffff",
        tile: npcSwatch("white"),
        slot: SLOT.stripe,
        skin: chainBlend([rig.index("chest"), rig.index(`upperArm${L}`), rig.index(`lowerArm${L}`)], [0.08, 0.5], 0.1),
      });
    }
  }
}

function shirt(b: PartBuilder, rig: KitRig) {
  shell(b, rig, "shirt", grow(SHIRT, 1.03, 0.004), { tile: NPC_CELLS.twill, slot: SLOT.top, thickness: 0.005 });
  const collar = loft(
    [
      [1.252, 0.104, 0.086],
      [1.29, 0.084, 0.072],
      [1.302, 0.09, 0.077],
      [1.276, 0.118, 0.097],
    ].map(([y, rx, rz], i) => hring([0, y, 0.002], rx, rz, { arc: [FRONT + 0.42 - i * 0.03, FRONT + Math.PI * 2 - 0.42 + i * 0.03] })),
    { segments: 18, thickness: 0.004 },
  );
  b.add(collar.geometry, { name: "shirt-collar", color: tone(0.96), tile: NPC_CELLS.twill, slot: SLOT.top, skin: torsoSkin(rig) });
  const placket = new THREE.BoxGeometry(0.03, 0.4, 0.004);
  placket.translate(0, 1.06, 0.112);
  b.add(placket, { name: "placket", color: tone(0.95), tile: NPC_CELLS.twill, slot: SLOT.top, skin: torsoSkin(rig) });
  for (let i = 0; i < 5; i++) {
    const btn = new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8);
    btn.rotateX(Math.PI / 2);
    btn.translate(0, 0.9 + i * 0.075, 0.116);
    b.add(btn, { name: "button", color: "#ffffff", tile: npcSwatch("white"), slot: 255, skin: torsoSkin(rig) });
  }
  const pocket = new THREE.BoxGeometry(0.06, 0.07, 0.006);
  pocket.rotateY(-0.35);
  pocket.translate(0.07, 1.13, 0.106);
  b.add(pocket, { name: "breast-pocket", color: tone(0.93), tile: NPC_CELLS.twill, slot: SLOT.top, skin: torsoSkin(rig) });
  for (const side of [1, -1] as const) sleeve(b, rig, side, { scale: 1.2, endY: 1.04, tile: NPC_CELLS.twill, slot: SLOT.top });
}

// ---------------------------------------------------------------- bottoms

function seat(b: PartBuilder, rig: KitRig, tile: typeof NPC_CELLS.knit, slot: number, belt = false) {
  const hips = rig.index("hips");
  const band = loft([0.85, 0.868, 0.886].map((y) => hring([0, y, 0.004], 0.157, 0.108)), { segments: 20, thickness: 0.006 });
  b.add(band.geometry, { name: "waistband", color: tone(belt ? 0.5 : 0.92), tile: belt ? npcSwatch("leather") : tile, slot: belt ? SLOT.acc2 : slot, skin: hips });
  if (belt) {
    const buckle = new THREE.BoxGeometry(0.032, 0.024, 0.008);
    buckle.translate(0, 0.868, 0.112);
    b.add(buckle, { name: "buckle", color: "#ffffff", tile: npcSwatch("metal"), slot: 255, skin: hips });
  }
  const pelvis = loft([hring([0, 0.87, 0.004], 0.154, 0.106), hring([0, 0.8, 0.002], 0.166, 0.11), hring([0, 0.75, 0], 0.164, 0.106)], { segments: 20 });
  b.add(pelvis.geometry, { name: "seat", color: "#ffffff", tile, slot, skin: hips });
  const gusset = new THREE.SphereGeometry(1, 10, 8);
  gusset.scale(0.07, 0.04, 0.095);
  gusset.translate(0, 0.752, 0);
  b.add(gusset, { name: "gusset", color: tone(0.92), tile, slot, skin: hips });
}

/** Full-length trouser leg; `fit` scales the radii, `crease` adds a pressed front line. */
function trouserLegs(b: PartBuilder, rig: KitRig, o: { tile: typeof NPC_CELLS.knit; slot: number; fit: number; crease?: boolean; cuffs?: boolean; roll?: boolean }) {
  for (const side of [1, -1] as const) {
    const L = side > 0 ? "L" : "R";
    const knee = rig.at(`lowerLeg${L}`);
    const ankle = rig.at(`foot${L}`);
    const inner = side > 0 ? Math.PI : 0;
    const shape = (th: number) => (1 - 0.1 * Math.max(0, Math.cos(th - inner))) * (o.crease ? 1 + 0.06 * Math.pow(Math.max(0, Math.sin(th)), 24) : 1);
    const rings: [number, number, number][] = [
      [0.81, 0.09, 0.0],
      [0.7, 0.086, 0.002],
      [0.55, 0.078, 0.004],
      [knee.y, 0.068, 0.006],
      [0.28, 0.064, -0.002],
      [0.14, 0.06, -0.004],
      [0.07, 0.062, -0.002],
    ];
    const leg = loft(
      rings.map(([y, r, z]) => hring([side * (0.084 + (0.81 - y) * 0.012), y, z], r * o.fit, r * o.fit * 1.04, { shape })),
      { segments: 14, thickness: 0.006 },
    );
    const top = rings[0][0];
    const bottom = rings[rings.length - 1][0];
    const skin: SkinFn = chainBlend(
      [rig.index("hips"), rig.index(`upperLeg${L}`), rig.index(`lowerLeg${L}`), rig.index(`foot${L}`)],
      [0.1, (top - knee.y) / (top - bottom), (top - ankle.y) / (top - bottom) + 0.03],
      0.06,
    );
    b.add(leg.geometry, { name: "trouser-leg", color: (_p, _t, _u, sh) => white.clone().multiplyScalar(sh === 1 ? 0.7 : 1), tile: o.tile, slot: o.slot, skin });
    if (o.cuffs || o.roll) {
      const r = rings[rings.length - 1][1] * o.fit * (o.roll ? 1.1 : 0.94);
      const cuff = loft([0.105, 0.088, 0.07].map((y) => hring([side * (0.084 + 0.74 * 0.012), y, -0.002], r, r * 1.04)), { segments: 14, thickness: 0.006 });
      b.add(cuff.geometry, { name: o.roll ? "rolled-hem" : "ankle-cuff", color: tone(o.roll ? 0.82 : 0.86), tile: o.tile, slot: o.slot, skin: rig.index(`lowerLeg${L}`) });
    }
  }
}

function jeans(b: PartBuilder, rig: KitRig) {
  seat(b, rig, NPC_CELLS.denim, SLOT.bottom);
  trouserLegs(b, rig, { tile: NPC_CELLS.denim, slot: SLOT.bottom, fit: 1, roll: true });
  for (const s of [-1, 1]) {
    const pocket = new THREE.BoxGeometry(0.075, 0.08, 0.006);
    pocket.translate(s * 0.075, 0.815, -0.112);
    b.add(pocket, { name: "back-pocket", color: tone(0.9), tile: NPC_CELLS.denim, slot: SLOT.bottom, skin: rig.index("hips") });
  }
}

function slacks(b: PartBuilder, rig: KitRig) {
  seat(b, rig, NPC_CELLS.twill, SLOT.bottom, true);
  trouserLegs(b, rig, { tile: NPC_CELLS.twill, slot: SLOT.bottom, fit: 1.02, crease: true });
}

function trackPants(b: PartBuilder, rig: KitRig) {
  seat(b, rig, NPC_CELLS.knit, SLOT.bottom);
  trouserLegs(b, rig, { tile: NPC_CELLS.knit, slot: SLOT.bottom, fit: 1.08, cuffs: true });
  for (const side of [1, -1] as const) {
    const L = side > 0 ? "L" : "R";
    const knee = rig.at(`lowerLeg${L}`);
    const x = (y: number) => side * (0.084 + (0.81 - y) * 0.012 + 0.09 * 1.02 * (y > 0.5 ? 1 : 0.85));
    const path: V3[] = [[x(0.86), 0.86, 0], [x(0.7), 0.7, 0], [x(knee.y), knee.y, 0.004], [x(0.25), 0.25, 0], [x(0.12), 0.12, 0]];
    const stripe = sweep(path, { width: () => 0.008, thickness: () => 0.0015, outward: [side, 0, 0], segments: 12, around: 4 });
    b.add(stripe.geometry, {
      name: "pant-stripe",
      color: "#ffffff",
      tile: npcSwatch("white"),
      slot: SLOT.stripe,
      skin: chainBlend([rig.index("hips"), rig.index(`upperLeg${L}`), rig.index(`lowerLeg${L}`)], [0.1, 0.55], 0.08),
    });
  }
}

/** Knee-length pleated skirt; the hem swings with the legs. */
function skirt(b: PartBuilder, rig: KitRig) {
  const hips = rig.index("hips");
  const legL = rig.index("upperLegL");
  const legR = rig.index("upperLegR");
  const waist = 0.885;
  const hem = 0.47;
  const pleats = (th: number) => 1 + 0.035 * Math.abs(Math.sin(th * 9));
  const rings = [waist, 0.84, 0.76, 0.66, 0.56, hem].map((y, i) => hring([0, y, 0.004 - i * 0.002], 0.156 + i * 0.022, 0.108 + i * 0.019, { shape: i ? pleats : undefined }));
  const lofted = loft(rings, { segments: 36, thickness: 0.005 });
  b.add(lofted.geometry, {
    name: "pleated-skirt",
    color: (_p, _t, _u, sh) => white.clone().multiplyScalar(sh === 1 ? 0.65 : 1),
    tile: NPC_CELLS.twill,
    slot: SLOT.bottom,
    skin: (p) => {
      const t = smoothstep(waist, hem, p.y);
      const lean = THREE.MathUtils.clamp(p.x / 0.12, -1, 1);
      const legs = t * 0.55;
      return [
        [hips, 1 - legs],
        [legL, legs * (0.5 + lean * 0.5)],
        [legR, legs * (0.5 - lean * 0.5)],
      ];
    },
  });
  const band = loft([0.868, 0.886, 0.902].map((y) => hring([0, y, 0.004], 0.158, 0.109)), { segments: 20, thickness: 0.006 });
  b.add(band.geometry, { name: "skirt-band", color: tone(0.85), tile: NPC_CELLS.twill, slot: SLOT.bottom, skin: hips });
}

function kneeSocks(b: PartBuilder, rig: KitRig) {
  for (const side of [1, -1] as const) {
    const L = side > 0 ? "L" : "R";
    const sock = loft(
      [
        [0.4, 0.056, 0.059, 0.004],
        [0.31, 0.055, 0.06, -0.006],
        [0.18, 0.042, 0.045, -0.008],
        [0.08, 0.04, 0.046, -0.01],
      ].map(([y, rx, rz, z]) => hring([side * 0.09, y, z], rx, rz)),
      { segments: 10, thickness: 0.004 },
    );
    b.add(sock.geometry, {
      name: "knee-sock",
      color: (p) => white.clone().multiplyScalar(p.y > 0.37 ? 0.9 : 1),
      tile: NPC_CELLS.knit,
      slot: SLOT.socks,
      skin: jointBlend(rig.index(`lowerLeg${L}`), rig.index(`foot${L}`), 0.86, 0.06),
    });
  }
}

// ---------------------------------------------------------------- shoes

function sneakers(b: PartBuilder, rig: KitRig) {
  b.slot = SLOT.shoe;
  for (const side of [1, -1] as const) {
    const L = side > 0 ? "L" : "R";
    addShoe(b, rig.at(`foot${L}`), side, rig.index(`foot${L}`), {
      shoe: NPC_CELLS.shoe,
      sole: NPC_CELLS.sole,
      accent: npcSwatch("accent"),
      lace: npcSwatch("lace"),
      tongue: npcSwatch("tongue"),
      accentSlot: SLOT.shoeAccent,
    });
  }
}

function loafers(b: PartBuilder, rig: KitRig) {
  for (const side of [1, -1] as const) {
    const L = side > 0 ? "L" : "R";
    const foot = rig.index(`foot${L}`);
    const x0 = rig.at(`foot${L}`).x;
    const rings: [number, number, number, number][] = [
      [-0.074, 0.04, 0.036, 0.034],
      [-0.05, 0.043, 0.044, 0.039],
      [0.0, 0.042, 0.048, 0.038],
      [0.06, 0.036, 0.05, 0.031],
      [0.12, 0.031, 0.046, 0.026],
      [0.165, 0.028, 0.034, 0.02],
      [0.186, 0.026, 0.016, 0.012],
    ];
    const upper = loft(rings.map(([z, y, rx, ry]) => ({ center: [x0, y, z] as V3, ax: [1, 0, 0] as V3, ay: [0, 1, 0] as V3, rx, ry })), { segments: 12, capStart: true, capEnd: true });
    b.add(upper.geometry, { name: "loafer", color: (p) => white.clone().multiplyScalar(p.y > 0.06 ? 0.85 : 1), tile: npcSwatch("leather"), slot: SLOT.shoe, skin: foot });
    const strap = new THREE.BoxGeometry(0.07, 0.008, 0.02);
    strap.rotateX(-0.25);
    strap.translate(x0, 0.071, 0.02);
    b.add(strap, { name: "penny-strap", color: tone(0.7), tile: npcSwatch("leather"), slot: SLOT.shoe, skin: foot });
    const soleShape = new THREE.Shape();
    soleShape.moveTo(-0.036, -0.08);
    soleShape.quadraticCurveTo(0, -0.09, 0.036, -0.08);
    soleShape.quadraticCurveTo(0.05, 0.05, 0.03, 0.18);
    soleShape.quadraticCurveTo(0, 0.2, -0.03, 0.18);
    soleShape.quadraticCurveTo(-0.05, 0.05, -0.036, -0.08);
    const sole = new THREE.ExtrudeGeometry(soleShape, { depth: 0.012, bevelEnabled: false, curveSegments: 5 });
    sole.rotateX(Math.PI / 2);
    sole.translate(x0, 0.012, 0);
    b.add(sole, { name: "loafer-sole", color: tone(0.35), tile: npcSwatch("leather"), slot: 255, skin: foot });
  }
}

// ---------------------------------------------------------------- hair

function hairline(front: number, side: number, back: number) {
  return (phi: number) => {
    const t = (1 - Math.cos(phi)) / 2;
    const a = t < 0.5 ? front + (side - front) * (t / 0.5) : side + (back - side) * ((t - 0.5) / 0.5);
    return a * DEG;
  };
}

function hairCap(b: PartBuilder, rig: KitRig, line: (phi: number) => number, dr = 0.011) {
  const cols = 24;
  const rows = 7;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const phi = (c / cols) * Math.PI * 2;
      const s = r / rows;
      pos.push(...headPoint(rig, phi, s * line(phi), dr - s * 0.004));
      uv.push(c / cols, 0.18 + s * 0.42);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * (cols + 1) + c;
      const j = i + cols + 1;
      idx.push(i, j, i + 1, i + 1, j, j + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Face outward.
  const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, cols + 4);
  const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, cols + 4);
  if (n.dot(p.sub(skullCenter(rig))) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  b.add(g, { name: "hair-cap", color: "#ffffff", tile: NPC_CELLS.hair, slot: SLOT.hair, skin: rig.index("head") });
}

function clump(b: PartBuilder, rig: KitRig, points: V3[], width: number, thickness: number, bone: number, shade = 1) {
  const c = skullCenter(rig);
  const out = (t: number) => {
    const i = Math.min(points.length - 1, Math.round(t * (points.length - 1)));
    return new THREE.Vector3(points[i][0] - c.x, points[i][1] - c.y, points[i][2] - c.z).normalize();
  };
  const lofted = sweep(points, {
    width: (t) => width * Math.pow(1 - t, 0.75) * (t < 0.12 ? 0.7 + t * 2.5 : 1),
    thickness: (t) => thickness * (1 - t * 0.85),
    outward: out,
    segments: 6,
    around: 5,
  });
  b.add(lofted.geometry, { name: "hair-clump", color: tone(shade), tile: NPC_CELLS.hair, slot: SLOT.hair, skin: bone });
}

function bangs(b: PartBuilder, rig: KitRig, n: number, spread: number, sweepTo: number, tipAlpha: (i: number) => number, width: number) {
  const headBone = rig.index("head");
  for (let i = 0; i < n; i++) {
    const phi = -spread + (i * 2 * spread) / (n - 1);
    clump(b, rig, [headPoint(rig, phi, 22 * DEG, -0.004), headPoint(rig, phi + sweepTo * 0.2, 48 * DEG, 0.017), headPoint(rig, phi + sweepTo * 0.65, 68 * DEG, 0.018), headPoint(rig, phi + sweepTo, tipAlpha(i), 0.013)], width, 0.01, headBone, i % 2 ? 0.92 : 1);
  }
}

function hairCrop(b: PartBuilder, rig: KitRig) {
  const head = rig.index("head");
  hairCap(b, rig, hairline(56, 92, 118), 0.012);
  bangs(b, rig, 7, 0.7, 0.05, (i) => (64 + (i % 2) * 4) * DEG, 0.03);
  for (let i = 0; i < 8; i++) {
    const phi = i * 0.785 + 0.2;
    clump(b, rig, [headPoint(rig, phi, 6 * DEG, 0.004), headPoint(rig, phi, 18 * DEG, 0.03), headPoint(rig, phi + 0.1, 32 * DEG, 0.034)], 0.034, 0.012, head, i % 2 ? 0.9 : 1);
  }
  for (let i = 0; i < 7; i++) {
    const phi = Math.PI - 1.1 + i * 0.366;
    clump(b, rig, [headPoint(rig, phi, 40 * DEG, 0), headPoint(rig, phi, 80 * DEG, 0.016), headPoint(rig, phi, 112 * DEG, 0.012)], 0.034, 0.011, head, i % 2 ? 0.92 : 1);
  }
  for (const s of [-1, 1]) {
    clump(b, rig, [headPoint(rig, s * 1.3, 50 * DEG, 0), headPoint(rig, s * 1.36, 80 * DEG, 0.012), headPoint(rig, s * 1.42, 96 * DEG, 0.01)], 0.03, 0.01, head);
  }
}

function hairLong(b: PartBuilder, rig: KitRig) {
  const chest = rig.index("chest");
  hairCap(b, rig, hairline(62, 99, 125));
  bangs(b, rig, 9, 0.9, 0.08, (i) => (80 + (i % 3) * 3) * DEG, 0.034);
  for (const s of [-1, 1]) {
    for (const [k, phi0] of [1.2, 1.45].entries()) {
      const top = headPoint(rig, s * phi0, 45 * DEG, 0);
      const mid = headPoint(rig, s * phi0, 100 * DEG, 0.022);
      clump(b, rig, [top, mid, [s * (0.105 + k * 0.012), 1.26, 0.04 - k * 0.03], [s * (0.12 + k * 0.012), 1.12, 0.06 - k * 0.03]], 0.04, 0.012, chest, k ? 0.92 : 1);
    }
  }
  for (let i = 0; i < 9; i++) {
    const phi = Math.PI - 1.0 + i * 0.25;
    const top = headPoint(rig, phi, 30 * DEG, 0);
    const mid = headPoint(rig, phi, 100 * DEG, 0.024);
    const x = mid[0] * 1.15;
    clump(b, rig, [top, mid, [x, 1.28, -0.15], [x * 1.05, 1.13, -0.165], [x * 1.08, 1.0, -0.16]], 0.046, 0.014, chest, i % 2 ? 0.9 : 1);
  }
}

function hairBob(b: PartBuilder, rig: KitRig) {
  const head = rig.index("head");
  hairCap(b, rig, hairline(62, 99, 125));
  bangs(b, rig, 9, 0.88, 0.0, () => 80 * DEG, 0.036);
  for (let i = 0; i < 13; i++) {
    const phi = 1.05 + i * 0.35;
    const tipIn = 0.012;
    clump(b, rig, [headPoint(rig, phi, 35 * DEG, 0), headPoint(rig, phi, 92 * DEG, 0.026), headPoint(rig, phi, 118 * DEG, 0.03), headPoint(rig, phi, 128 * DEG, tipIn)], 0.05, 0.016, head, i % 2 ? 0.9 : 1);
  }
}

function hairPonytail(b: PartBuilder, rig: KitRig) {
  const head = rig.index("head");
  const tail = rig.index("hairTail");
  hairCap(b, rig, hairline(64, 100, 126), 0.009);
  bangs(b, rig, 7, 0.75, 0.16, (i) => (76 + (i % 2) * 5) * DEG, 0.032);
  for (const s of [-1, 1]) {
    clump(b, rig, [headPoint(rig, s * 1.3, 48 * DEG, 0), headPoint(rig, s * 1.32, 88 * DEG, 0.012), headPoint(rig, s * 1.2, 114 * DEG, 0.012)], 0.026, 0.009, head);
  }
  const t = rig.at("hairTail");
  const tie = new THREE.TorusGeometry(0.02, 0.008, 6, 12);
  tie.lookAt(new THREE.Vector3(0, -0.3, -1));
  tie.translate(t.x, t.y + 0.01, t.z - 0.01);
  b.add(tie, { name: "hair-tie", color: "#ffffff", tile: npcSwatch("white"), slot: SLOT.acc2, skin: tail });
  for (const [i, dx] of [-0.018, -0.006, 0.006, 0.018, 0].entries()) {
    const o: V3 = [t.x + dx * 0.4, t.y + 0.01, t.z - 0.012];
    clump(b, rig, [o, [o[0] + dx, o[1] - 0.03, o[2] - 0.06], [o[0] + dx * 1.4, o[1] - 0.15, o[2] - 0.085], [o[0] + dx * 1.6, o[1] - 0.29, o[2] - 0.07]], i === 4 ? 0.03 : 0.024, 0.014, tail, i % 2 ? 0.92 : 1);
  }
}

// ---------------------------------------------------------------- accessories

function glasses(b: PartBuilder, rig: KitRig) {
  const c = skullCenter(rig);
  const head = rig.index("head");
  const y = c.y - 0.018;
  for (const s of [-1, 1]) {
    const cx = c.x + s * 0.046;
    const z = c.z + 0.118 * 0.95 + 0.012;
    const ring: V3[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ring.push([cx + Math.cos(a) * 0.024, y + Math.sin(a) * 0.017, z - Math.abs(Math.cos(a)) * 0.004]);
    }
    const rim = sweep(ring, { width: () => 0.0024, thickness: () => 0.0024, outward: [0, 0, 1], segments: 24, around: 4 });
    b.add(rim.geometry, { name: "glasses-rim", color: "#ffffff", tile: npcSwatch("frame"), slot: SLOT.acc2, skin: head });
    const temple = sweep([[cx + s * 0.024, y + 0.004, z - 0.004], [c.x + s * 0.112, y + 0.006, c.z + 0.04], [c.x + s * 0.116, y - 0.004, c.z - 0.02]], { width: () => 0.002, thickness: () => 0.002, outward: [s, 0, 0], segments: 6, around: 4 });
    b.add(temple.geometry, { name: "glasses-temple", color: "#ffffff", tile: npcSwatch("frame"), slot: SLOT.acc2, skin: head });
  }
  const bridge = sweep([[c.x - 0.022, y + 0.004, c.z + 0.124], [c.x, y + 0.009, c.z + 0.127], [c.x + 0.022, y + 0.004, c.z + 0.124]], { width: () => 0.002, thickness: () => 0.002, outward: [0, 0, 1], segments: 4, around: 4 });
  b.add(bridge.geometry, { name: "glasses-bridge", color: "#ffffff", tile: npcSwatch("frame"), slot: SLOT.acc2, skin: head });
}

function tote(b: PartBuilder, rig: KitRig) {
  const chest = rig.index("chest");
  const bag = new RoundedBoxGeometry(0.06, 0.3, 0.28, 2, 0.012);
  bag.rotateZ(0.08);
  bag.translate(-0.215, 0.88, -0.005);
  b.add(bag, { name: "tote", color: "#ffffff", tile: NPC_CELLS.twill, slot: SLOT.acc, skin: chest });
  for (const [i, dz] of [-0.07, 0.04].entries()) {
    const book = new THREE.BoxGeometry(0.03, 0.22, 0.17);
    book.translate(-0.208, 0.98 + i * 0.012, dz * 0.4);
    b.add(book, { name: "book", color: i ? "#ffffff" : tone(0.8), tile: npcSwatch("paper"), slot: SLOT.acc2, skin: chest });
  }
  for (const dz of [-0.07, 0.07]) {
    const strap = sweep([[-0.205, 1.02, dz], [-0.19, 1.16, dz * 0.6], [-0.135, 1.245, dz * 0.25], [-0.09, 1.262, dz * 0.1]], { width: () => 0.011, thickness: () => 0.003, outward: [-1, 0.4, 0], segments: 8, around: 4 });
    b.add(strap.geometry, { name: "tote-strap", color: tone(0.9), tile: NPC_CELLS.twill, slot: SLOT.acc, skin: chest });
  }
}

function drawingTube(b: PartBuilder, rig: KitRig) {
  const chest = rig.index("chest");
  const dir = new THREE.Vector3(0.55, -1, 0).normalize();
  const center = new THREE.Vector3(0.0, 1.08, -0.17);
  const place = (g: THREE.BufferGeometry, along: number) => {
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(center.x + dir.x * along, center.y + dir.y * along, center.z + dir.z * along);
    return g;
  };
  b.add(place(new THREE.CylinderGeometry(0.045, 0.045, 0.58, 12, 1), 0), { name: "drawing-tube", color: "#ffffff", tile: npcSwatch("plastic"), slot: SLOT.acc, skin: chest });
  for (const end of [-0.3, 0.3]) {
    b.add(place(new THREE.CylinderGeometry(0.049, 0.049, 0.035, 12, 1), end), { name: "tube-cap", color: "#ffffff", tile: npcSwatch("ink"), slot: 255, skin: chest });
  }
  const strap = sweep([[0.14, 1.24, -0.06], [0.0, 1.27, 0.06], [-0.11, 1.18, 0.11], [-0.17, 1.02, 0.07], [-0.15, 0.88, -0.05]], { width: () => 0.012, thickness: () => 0.003, outward: [0, 0, 1], segments: 12, around: 4 });
  b.add(strap.geometry, { name: "tube-strap", color: "#ffffff", tile: npcSwatch("ink"), slot: 255, skin: chest });
}

function earphones(b: PartBuilder, rig: KitRig) {
  const c = skullCenter(rig);
  const head = rig.index("head");
  const band: V3[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    band.push([c.x + Math.sin(a) * 0.13, c.y + 0.01 + Math.cos(a) * 0.15, c.z - 0.01]);
  }
  const arc = sweep(band, { width: () => 0.012, thickness: () => 0.006, outward: [0, 1, 0], segments: 16, around: 5 });
  b.add(arc.geometry, { name: "headband", color: "#ffffff", tile: npcSwatch("plastic"), slot: SLOT.acc, skin: head });
  for (const s of [-1, 1]) {
    const cup = new THREE.CylinderGeometry(0.036, 0.036, 0.026, 14);
    cup.rotateZ(Math.PI / 2);
    cup.translate(c.x + s * 0.128, c.y - 0.008, c.z - 0.01);
    b.add(cup, { name: "ear-cup", color: tone(0.85), tile: npcSwatch("plastic"), slot: SLOT.acc, skin: head });
    const pad = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12);
    pad.rotateZ(Math.PI / 2);
    pad.translate(c.x + s * 0.113, c.y - 0.008, c.z - 0.01);
    b.add(pad, { name: "ear-pad", color: "#ffffff", tile: npcSwatch("ink"), slot: 255, skin: head });
  }
}

function cap(b: PartBuilder, rig: KitRig) {
  const c = skullCenter(rig);
  const head = rig.index("head");
  const crown = dome(0.122, 0.105, 0.128, 6, 18);
  crown.geometry.translate(c.x, c.y + 0.03, c.z - 0.004);
  b.add(crown.geometry, { name: "cap-crown", color: "#ffffff", tile: NPC_CELLS.twill, slot: SLOT.acc, skin: head });
  const brim = new THREE.CircleGeometry(0.11, 18, -Math.PI * 0.05, Math.PI * 1.1);
  brim.scale(1, 0.9, 1);
  brim.rotateX(-Math.PI / 2 + 0.12);
  brim.translate(c.x, c.y + 0.035, c.z + 0.09);
  b.add(brim, { name: "cap-brim", color: tone(0.88), tile: NPC_CELLS.twill, slot: SLOT.acc, skin: head });
  const under = brim.clone();
  const ix = under.index!.array as Uint16Array;
  for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
  under.translate(0, -0.003, 0);
  under.computeVertexNormals();
  b.add(under, { name: "cap-brim-under", color: tone(0.6), tile: NPC_CELLS.twill, slot: SLOT.acc, skin: head });
  const button = new THREE.SphereGeometry(0.012, 8, 6);
  button.translate(c.x, c.y + 0.137, c.z - 0.004);
  b.add(button, { name: "cap-button", color: tone(0.8), tile: NPC_CELLS.twill, slot: SLOT.acc, skin: head });
}

function bottle(b: PartBuilder, rig: KitRig) {
  const hand = rig.index("handL");
  const w = rig.at("handL");
  const body = new THREE.CylinderGeometry(0.03, 0.03, 0.19, 12);
  body.translate(w.x - 0.012, w.y - 0.07, w.z + 0.05);
  b.add(body, { name: "bottle", color: "#ffffff", tile: npcSwatch("plastic"), slot: SLOT.acc, skin: hand });
  const lid = new THREE.CylinderGeometry(0.026, 0.028, 0.035, 10);
  lid.translate(w.x - 0.012, w.y + 0.04, w.z + 0.05);
  b.add(lid, { name: "bottle-lid", color: "#ffffff", tile: npcSwatch("ink"), slot: 255, skin: hand });
}

export const NPC_PARTS: PartDef[] = [
  { id: "head:soft", slot: "head", build: head("faceA") },
  { id: "head:sharp", slot: "head", build: head("faceB") },
  { id: "arms:bare", slot: "arms", build: bareArms },
  { id: "legs:bare", slot: "legs", build: bareLegs },
  { id: "top:hoodie", slot: "top", build: hoodie },
  { id: "top:cardigan", slot: "top", build: cardigan },
  { id: "top:track", slot: "top", build: track },
  { id: "top:shirt", slot: "top", build: shirt },
  { id: "bottom:jeans", slot: "bottom", build: jeans },
  { id: "bottom:skirt", slot: "bottom", build: skirt },
  { id: "bottom:track", slot: "bottom", build: trackPants },
  { id: "bottom:slacks", slot: "bottom", build: slacks },
  { id: "socks:knee", slot: "socks", build: kneeSocks },
  { id: "shoes:sneaker", slot: "shoes", build: sneakers },
  { id: "shoes:loafer", slot: "shoes", build: loafers },
  { id: "hair:crop", slot: "hair", build: hairCrop },
  { id: "hair:long", slot: "hair", build: hairLong },
  { id: "hair:bob", slot: "hair", build: hairBob },
  { id: "hair:ponytail", slot: "hair", build: hairPonytail },
  { id: "acc:glasses", slot: "acc", build: glasses },
  { id: "acc:tote", slot: "acc", build: tote },
  { id: "acc:tube", slot: "acc", build: drawingTube },
  { id: "acc:earphones", slot: "acc", build: earphones },
  { id: "acc:cap", slot: "acc", build: cap },
  { id: "acc:bottle", slot: "acc", build: bottle },
];

void ([] as Ring[]);
