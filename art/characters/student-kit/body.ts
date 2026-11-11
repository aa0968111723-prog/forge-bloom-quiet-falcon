/**
 * Student body and clothing, authored in bind space around the kit skeleton.
 *
 * Covered anatomy is not modelled: the jacket and shirt *are* the torso
 * silhouette, the shorts are the hips. Visible skin is head, neck, forearms,
 * hands and lower legs. Garments are lofted shells with real thickness on
 * their open edges, so hems, cuffs and the jacket opening read as cloth.
 */
import * as THREE from "three";
import { ExtrudeGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  chainBlend,
  jointBlend,
  smoothstep,
  type ColorFn,
  type PartBuilder,
  type SkinFn,
  type V3,
} from "../../shared/builder.ts";
import { hring, limbRing, loft, sweep, type Ring } from "../../shared/loft.ts";
import { CELLS, FACE_EXTENT, swatch } from "./atlas.ts";
import type { KitRig } from "./skeleton.ts";
import { STUDENT_KIT } from "./spec.ts";

const white = new THREE.Color(1, 1, 1);
const FRONT = Math.PI / 2;

/** Jacket cross-sections: [height, half-width, half-depth, z offset, front half-opening]. */
export const JACKET_RINGS: [number, number, number, number, number][] = [
  [0.83, 0.174, 0.124, 0.002, 0.78],
  [0.88, 0.168, 0.118, 0.003, 0.7],
  [0.95, 0.157, 0.112, 0.004, 0.62],
  [1.02, 0.159, 0.114, 0.006, 0.53],
  [1.08, 0.168, 0.12, 0.007, 0.45],
  [1.14, 0.176, 0.12, 0.005, 0.38],
  [1.19, 0.183, 0.114, 0.0, 0.32],
  [1.225, 0.166, 0.104, -0.003, 0.28],
  [1.252, 0.122, 0.094, -0.002, 0.26],
];

/** Point on the jacket's outer surface at height `y`, offset outward by `off`. */
export function onJacket(x: number, y: number, front: boolean, off: number): V3 {
  let i = 0;
  while (i < JACKET_RINGS.length - 2 && JACKET_RINGS[i + 1][0] < y) i++;
  const a = JACKET_RINGS[i];
  const b = JACKET_RINGS[i + 1];
  const t = Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0])));
  // Ring radii are the outer surface; the cloth thickness lies inside them.
  const rx = a[1] + (b[1] - a[1]) * t;
  const rz = a[2] + (b[2] - a[2]) * t;
  const zc = a[3] + (b[3] - a[3]) * t;
  const q = Math.min(0.995, Math.abs(x) / rx);
  const zs = Math.sqrt(1 - q * q) * rz;
  // Push out along the ellipse normal.
  const nx = x / (rx * rx);
  const nz = (front ? zs : -zs) / (rz * rz);
  const nl = Math.hypot(nx, nz) || 1;
  return [x + (nx / nl) * off, y, zc + (front ? zs : -zs) + (nz / nl) * off];
}

/** Vertex colour that darkens toward the part's ends — soft baked occlusion. */
function endShade(lo: number, hi: number, k = 0.78): ColorFn {
  return (_p, t) => white.clone().multiplyScalar(1 - (1 - k) * (1 - smoothstep(lo, hi, t)));
}

/** Skin weights for torso garments by height: hips → spine → chest → neck. */
function torsoSkin(rig: KitRig): SkinFn {
  const hips = rig.index("hips");
  const spine = rig.index("spine");
  const chest = rig.index("chest");
  const neck = rig.index("neck");
  return (p) => {
    const y = p.y;
    const a = 1 - smoothstep(0.86, 0.96, y);
    const c = smoothstep(1.0, 1.1, y);
    const n = smoothstep(1.245, 1.29, y);
    const s = Math.max(0, 1 - a - c);
    return [
      [hips, a],
      [spine, s],
      [chest, c * (1 - n)],
      [neck, c * n],
    ];
  };
}

export function addHead(b: PartBuilder, rig: KitRig) {
  const head = rig.index("head");
  const neckBone = rig.index("neck");
  const { center, radius } = STUDENT_KIT.head;
  const c = rig.at("head").add(new THREE.Vector3(...(center as unknown as V3)));
  const [rx, ry, rz] = radius as unknown as V3;

  const sphere = new THREE.SphereGeometry(1, 38, 28).toNonIndexed();
  const pos = sphere.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let { x, y, z } = v;
    // Jaw: taper width and depth below the cheekbones; chin slightly forward.
    if (y < 0) {
      const k = Math.pow(-y, 1.55);
      x *= 1 - 0.36 * k;
      z *= 1 - 0.2 * k;
      y *= 1 + 0.05 * k;
      if (z > 0) z += 0.1 * k * k;
    }
    // Soft cheeks just under the eye line.
    const cheek = Math.exp(-Math.pow((y + 0.25) / 0.25, 2)) * Math.max(0, z);
    x *= 1 + 0.05 * cheek;
    if (z > 0) z *= 0.95;
    else z *= 1.05;
    pos.setXYZ(i, c.x + x * rx, c.y + y * ry, c.z + z * rz);
  }
  sphere.computeVertexNormals();

  // Front-facing triangles take the painted face; the rest of the skull
  // samples plain skin (it is under the hair anyway).
  const front = new THREE.BufferGeometry();
  const back = new THREE.BufferGeometry();
  const fp: number[] = [];
  const fn: number[] = [];
  const fu: number[] = [];
  const bp: number[] = [];
  const bn: number[] = [];
  const nor = sphere.attributes.normal;
  for (let t = 0; t < pos.count; t += 3) {
    let zSum = 0;
    for (let k = 0; k < 3; k++) zSum += pos.getZ(t + k) - c.z;
    const isFront = zSum / 3 > -0.01;
    for (let k = 0; k < 3; k++) {
      const i = t + k;
      const target = isFront ? fp : bp;
      const tn = isFront ? fn : bn;
      target.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      tn.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      if (isFront) {
        fu.push(
          0.5 + (pos.getX(i) - c.x) / (FACE_EXTENT.halfWidth * 2),
          0.5 + (pos.getY(i) - c.y) / (FACE_EXTENT.halfHeight * 2),
        );
      }
    }
  }
  front.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3));
  front.setAttribute("normal", new THREE.Float32BufferAttribute(fn, 3));
  front.setAttribute("uv", new THREE.Float32BufferAttribute(fu, 2));
  back.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
  back.setAttribute("normal", new THREE.Float32BufferAttribute(bn, 3));
  sphere.dispose();
  b.add(front, { name: "face", color: "#ffffff", tile: CELLS.face, skin: head });
  b.add(back, { name: "skull", color: "#ffffff", tile: CELLS.skin, skin: head });

  // Ears, half hidden by the side locks.
  for (const side of [-1, 1]) {
    const ear = new THREE.SphereGeometry(1, 12, 10);
    ear.scale(0.014, 0.027, 0.02);
    ear.rotateZ(-side * 0.18);
    ear.translate(c.x + side * rx * 0.98, c.y - 0.012, c.z - 0.008);
    b.add(ear, { name: "ear", color: "#f6efea", tile: CELLS.skin, skin: head });
  }

  // Neck, blended from chest to head so turning the head creases nothing.
  const neck = loft(
    [
      hring(rig.p("chest", [0, 0.15, -0.004]), 0.045, 0.043),
      hring(rig.p("neck", [0, 0.03, 0.006]), 0.04, 0.039),
      hring(rig.p("head", [0, 0.04, 0.014]), 0.037, 0.036),
    ],
    { segments: 16 },
  );
  b.add(neck.geometry, {
    name: "neck",
    color: (p) => white.clone().multiplyScalar(0.86 + 0.14 * smoothstep(1.27, 1.33, p.y)),
    tile: CELLS.skin,
    skin: chainBlend([rig.index("chest"), neckBone, head], [0.25, 0.75], 0.18),
    param: neck.param,
  });
}

export function addTorso(b: PartBuilder, rig: KitRig) {
  const skin = torsoSkin(rig);
  // Ivory tee: closed, slightly flared at the hem.
  const shirtRings: [number, number, number, number][] = [
    [0.872, 0.152, 0.104, 0.004],
    [0.92, 0.146, 0.098, 0.004],
    [0.98, 0.138, 0.094, 0.005],
    [1.04, 0.142, 0.097, 0.007],
    [1.1, 0.152, 0.103, 0.008],
    [1.155, 0.159, 0.102, 0.006],
    [1.2, 0.163, 0.096, 0.0],
    [1.232, 0.146, 0.087, -0.003],
    [1.255, 0.098, 0.074, -0.001],
    [1.27, 0.062, 0.058, 0.004],
  ];
  const shirt = loft(
    shirtRings.map(([y, rx, rz, z]) =>
      hring([0, y, z], rx, rz, {
        bulge: (th) => (y > 1.06 && y < 1.18 ? Math.max(0, Math.sin(th)) * 0.006 : 0),
      }),
    ),
    { segments: 24, thickness: 0.004 },
  );
  b.add(shirt.geometry, { name: "shirt", color: endShade(0, 0.06, 0.86), tile: CELLS.shirt, skin, param: shirt.param, uvRepeat: [2, 1] });

  // Jade overshirt: open front that widens toward the hem, 11 mm thick.
  const jacket = loft(
    JACKET_RINGS.map(([y, rx, rz, z, g]) =>
      hring([0, y, z], rx, rz, {
        arc: [FRONT + g, FRONT + Math.PI * 2 - g],
        // Front panels fall slightly forward of the body, like a real drape.
        bulge: (th) => (Math.cos(th - FRONT) > 0.4 ? 0.006 : 0),
      }),
    ),
    { segments: 26, thickness: 0.011 },
  );
  b.add(jacket.geometry, {
    name: "jacket",
    // Inner face reads as lining in shade; the cut edge sits between.
    color: (_p, _t, _u, shell) => white.clone().multiplyScalar(shell === 1 ? 0.7 : shell === 0.5 ? 0.86 : 1),
    tile: CELLS.jacket,
    skin,
    param: jacket.param,
    uvRepeat: [3, 1],
  });

  // Folded collar standing around the neck and turned down over the jacket.
  const collar = loft(
    [
      [1.243, 0.11, 0.09, -0.002],
      [1.285, 0.086, 0.073, 0.002],
      [1.302, 0.093, 0.08, 0.002],
      [1.278, 0.13, 0.106, 0.0],
      [1.24, 0.153, 0.12, -0.002],
    ].map(([y, rx, rz, z], i) =>
      hring([0, y, z], rx, rz, { arc: [FRONT + 0.52 - i * 0.04, FRONT + Math.PI * 2 - 0.52 + i * 0.04] }),
    ),
    { segments: 22, thickness: 0.006 },
  );
  b.add(collar.geometry, {
    name: "collar",
    color: (_p, t, _u, shell) => white.clone().multiplyScalar(t < 0.45 || shell === 1 ? 0.8 : 1),
    tile: CELLS.jacket,
    skin,
    param: collar.param,
  });

  // Patch pockets with flaps, buttons along the left placket, chest badge.
  for (const side of [-1, 1]) {
    const angle = FRONT + side * 0.95;
    const px = Math.cos(angle) * 0.162;
    const pz = Math.sin(angle) * 0.118 + 0.01;
    const pocket = new RoundedBoxGeometry(0.075, 0.08, 0.008, 1, 0.004);
    pocket.rotateY(side * -0.7);
    pocket.translate(px, 0.925, pz);
    b.add(pocket, { name: "pocket", color: "#e8f1ec", tile: CELLS.jacket, skin });
    const flap = new RoundedBoxGeometry(0.08, 0.022, 0.01, 1, 0.004);
    flap.rotateY(side * -0.7);
    flap.translate(px * 1.005, 0.972, pz + 0.002);
    b.add(flap, { name: "pocket-flap", color: "#c9ddd2", tile: CELLS.jacket, skin });
  }
  for (let i = 0; i < 4; i++) {
    const y = 0.9 + i * 0.085;
    const g = 0.7 - i * 0.085;
    const angle = FRONT + g + 0.07;
    const button = new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 10);
    button.rotateX(Math.PI / 2);
    button.rotateY(angle - FRONT);
    const rr = 0.17 + i * 0.004;
    button.translate(Math.cos(angle) * rr, y, Math.sin(angle) * 0.122 + 0.012);
    b.add(button, { name: "button", color: "#ffffff", tile: swatch("button"), skin });
  }
  const badge = new THREE.CylinderGeometry(0.017, 0.017, 0.004, 18);
  badge.rotateX(Math.PI / 2);
  badge.rotateY(-0.55);
  badge.translate(0.095, 1.135, 0.13);
  b.add(badge, { name: "badge", color: "#ffffff", tile: swatch("badgeGold"), skin });
  const badgeInner = new THREE.CylinderGeometry(0.011, 0.011, 0.005, 6);
  badgeInner.rotateX(Math.PI / 2);
  badgeInner.rotateY(-0.55);
  badgeInner.translate(0.0965, 1.135, 0.1315);
  b.add(badgeInner, { name: "badge-mark", color: "#ffffff", tile: swatch("badgeJade"), skin });
}

/** One sleeve, cuff, forearm and hand for side +1 (left, +X) or -1 (right). */
export function addArm(b: PartBuilder, rig: KitRig, side: 1 | -1) {
  const L = side > 0 ? "L" : "R";
  const chest = rig.index("chest");
  const upper = rig.index(`upperArm${L}`);
  const lower = rig.index(`lowerArm${L}`);
  const hand = rig.index(`hand${L}`);
  const sh = rig.at(`upperArm${L}`);
  const el = rig.at(`lowerArm${L}`);
  const wr = rig.at(`hand${L}`);
  const fwd: V3 = [0, 0, 1];
  const X = (x: number) => x * side;

  const centers: { c: V3; d: V3; r: [number, number] }[] = [
    { c: [X(0.118), 1.214, -0.005], d: [X(1), -0.15, 0], r: [0.07, 0.068] },
    { c: [X(0.158), 1.206, -0.005], d: [X(0.55), -1, 0], r: [0.069, 0.067] },
    { c: [X(0.177), 1.12, -0.005], d: [X(0.15), -1, 0], r: [0.063, 0.061] },
    { c: [X(0.19), 1.04, -0.005], d: [X(0.15), -1, 0], r: [0.058, 0.057] },
    { c: el.toArray() as V3, d: [X(0.11), -1, 0.02], r: [0.056, 0.055] },
    { c: [X(0.206), 0.93, 0.0], d: [X(0.1), -1, 0.06], r: [0.054, 0.053] },
    { c: [X(0.21), 0.895, 0.003], d: [X(0.1), -1, 0.08], r: [0.055, 0.054] },
  ];
  const rings = centers.map(({ c, d, r }) => limbRing(c, d, fwd, r[0], r[1]));
  const sleeve = loft(rings, { segments: 16, thickness: 0.009 });
  const tShoulder = paramAt(centers.map((x) => x.c), 1);
  const tElbow = paramAt(centers.map((x) => x.c), 4);
  b.add(sleeve.geometry, {
    name: "sleeve",
    color: endShade(0, 0.08, 0.8),
    tile: CELLS.jacket,
    skin: chainBlend([chest, upper, lower], [tShoulder, tElbow], 0.09),
    param: sleeve.param,
    uvRepeat: [2, 1],
  });

  // Turned-back cuff: a thick rolled band in the lighter lining colour.
  const cuff = loft(
    [
      limbRing([X(0.207), 0.912, 0.002], [X(0.1), -1, 0.07], fwd, 0.059, 0.058),
      limbRing([X(0.209), 0.896, 0.003], [X(0.1), -1, 0.07], fwd, 0.064, 0.063),
      limbRing([X(0.212), 0.876, 0.005], [X(0.1), -1, 0.07], fwd, 0.06, 0.059),
    ],
    { segments: 16, thickness: 0.008 },
  );
  b.add(cuff.geometry, {
    name: "cuff",
    color: (_p, t) => white.clone().multiplyScalar(t > 0.5 ? 0.92 : 1),
    tile: swatch("lining"),
    skin: lower,
    param: cuff.param,
  });

  const forearm = loft(
    [
      limbRing([X(0.206), 0.915, 0.0], [X(0.08), -1, 0.08], fwd, 0.041, 0.04),
      limbRing([X(0.212), 0.86, 0.005], [X(0.08), -1, 0.08], fwd, 0.038, 0.037),
      limbRing([X(0.217), 0.81, 0.01], [X(0.08), -1, 0.08], fwd, 0.034, 0.033),
      limbRing(rig.p(`hand${L}`, [0, 0.008, 0]), [X(0.08), -1, 0.08], fwd, 0.031, 0.03),
    ],
    { segments: 12 },
  );
  b.add(forearm.geometry, {
    name: "forearm",
    color: "#ffffff",
    tile: CELLS.skin,
    skin: jointBlend(lower, hand, 0.85, 0.08),
    param: forearm.param,
  });

  // Hand: palm, four curled fingers and a thumb, rigid on the hand bone.
  const w = wr.clone();
  const palmRing = (dy: number, rx: number, rz: number): Ring => ({
    center: [w.x + X(0.002), w.y + dy, w.z],
    ax: [1, 0, 0],
    ay: [0, 0, 1],
    rx,
    ry: rz,
  });
  const palm = loft([palmRing(0.005, 0.016, 0.028), palmRing(-0.035, 0.019, 0.036), palmRing(-0.07, 0.016, 0.037)], {
    segments: 14,
    capEnd: true,
  });
  b.add(palm.geometry, { name: "palm", color: "#ffffff", tile: CELLS.skin, skin: hand, param: palm.param });
  const fingers: [number, number][] = [
    [0.027, 0.054],
    [0.009, 0.06],
    [-0.009, 0.056],
    [-0.026, 0.046],
  ];
  for (const [dz, len] of fingers) {
    const root: V3 = [w.x + X(0.001), w.y - 0.068, w.z + dz];
    const finger = sweep(
      [
        root,
        [root[0] - X(0.004), root[1] - len * 0.5, root[2] + 0.002],
        [root[0] - X(0.013), root[1] - len * 0.9, root[2] + 0.003],
      ],
      {
        width: (t) => 0.0088 * roundTip(t),
        thickness: (t) => 0.0078 * roundTip(t),
        outward: [X(1), 0, 0],
        segments: 6,
        around: 8,
      },
    );
    b.add(finger.geometry, { name: "finger", color: "#ffffff", tile: CELLS.skin, skin: hand, param: finger.param });
  }
  const thumbRoot: V3 = [w.x - X(0.008), w.y - 0.03, w.z + 0.03];
  const thumb = sweep(
    [thumbRoot, [thumbRoot[0] - X(0.006), thumbRoot[1] - 0.022, thumbRoot[2] + 0.016], [thumbRoot[0] - X(0.012), thumbRoot[1] - 0.04, thumbRoot[2] + 0.02]],
    {
      width: (t) => 0.0098 * roundTip(t),
      thickness: (t) => 0.0085 * roundTip(t),
      outward: [X(1), 0, 0.4],
      segments: 6,
      around: 8,
    },
  );
  b.add(thumb.geometry, { name: "thumb", color: "#ffffff", tile: CELLS.skin, skin: hand, param: thumb.param });
  void sh;
}

/** Beige shorts, bare legs, socks and white sneakers. */
export function addLowerBody(b: PartBuilder, rig: KitRig) {
  const hips = rig.index("hips");
  const waist = loft(
    [hring([0, 0.835, 0.004], 0.156, 0.107), hring([0, 0.852, 0.004], 0.158, 0.108), hring([0, 0.868, 0.004], 0.155, 0.106)],
    { segments: 24, thickness: 0.006 },
  );
  b.add(waist.geometry, { name: "waistband", color: "#f0e8d8", tile: CELLS.shorts, skin: hips, param: waist.param, uvRepeat: [3, 1] });
  const pelvis = loft(
    [hring([0, 0.838, 0.004], 0.154, 0.105), hring([0, 0.79, 0.002], 0.166, 0.11), hring([0, 0.75, 0.0], 0.165, 0.106)],
    { segments: 24 },
  );
  b.add(pelvis.geometry, { name: "shorts-seat", color: "#ffffff", tile: CELLS.shorts, skin: hips, param: pelvis.param, uvRepeat: [3, 1] });
  const crotch = new THREE.SphereGeometry(1, 14, 10);
  crotch.scale(0.07, 0.04, 0.095);
  crotch.translate(0, 0.752, 0.0);
  b.add(crotch, { name: "shorts-gusset", color: "#e8e0cf", tile: CELLS.shorts, skin: hips });
  // Drawstring with aglets.
  for (const side of [-1, 1]) {
    const cord = sweep(
      [
        [side * 0.008, 0.853, 0.112],
        [side * 0.014, 0.83, 0.115],
        [side * 0.012, 0.8, 0.114],
      ],
      { width: () => 0.0028, thickness: () => 0.0028, outward: [0, 0, 1], segments: 4, around: 6 },
    );
    b.add(cord.geometry, { name: "drawstring", color: "#ffffff", tile: swatch("lace"), skin: hips, param: cord.param });
  }

  for (const side of [-1, 1] as const) {
    const L = side > 0 ? "L" : "R";
    const upLeg = rig.index(`upperLeg${L}`);
    const loLeg = rig.index(`lowerLeg${L}`);
    const foot = rig.index(`foot${L}`);
    const X = (x: number) => x * side;
    // Leg tube of the shorts; inner side flattened against the other leg.
    const inner = side > 0 ? Math.PI : 0;
    const flatInner = (th: number) => 1 - 0.1 * Math.max(0, Math.cos(th - inner));
    const legShorts = loft(
      [
        hring([X(0.082), 0.805, 0.001], 0.087, 0.104, { shape: flatInner }),
        hring([X(0.087), 0.71, 0.002], 0.087, 0.096, { shape: flatInner }),
        hring([X(0.092), 0.632, 0.003], 0.088, 0.093, { shape: flatInner }),
      ],
      { segments: 18, thickness: 0.008 },
    );
    b.add(legShorts.geometry, {
      name: "shorts-leg",
      color: endShade(0.75, 1, 0.92),
      tile: CELLS.shorts,
      skin: jointBlend(hips, upLeg, 0.3, 0.3),
      param: legShorts.param,
      uvRepeat: [2, 1],
    });
    const hem = loft(
      [hring([X(0.092), 0.64, 0.003], 0.09, 0.095), hring([X(0.093), 0.625, 0.003], 0.094, 0.099), hring([X(0.093), 0.608, 0.003], 0.091, 0.096)],
      { segments: 18, thickness: 0.007 },
    );
    b.add(hem.geometry, { name: "shorts-hem", color: "#e2d6bf", tile: CELLS.shorts, skin: upLeg, param: hem.param, uvRepeat: [2, 1] });

    // Bare leg with a knee and a calf, hidden at the top inside the shorts.
    const knee = rig.at(`lowerLeg${L}`);
    const ankle = rig.at(`foot${L}`);
    const legRings: [number, number, number, number, number][] = [
      [0.68, X(0.088), 0.0, 0.066, 0.068],
      [0.6, X(0.089), 0.0, 0.062, 0.064],
      [0.52, X(0.09), 0.0, 0.057, 0.06],
      [0.455, X(0.09), 0.002, 0.051, 0.054],
      [knee.y, knee.x, knee.z + 0.004, 0.049, 0.053],
      [0.37, X(0.09), 0.0, 0.049, 0.052],
      [0.305, X(0.09), -0.007, 0.052, 0.057],
      [0.23, X(0.09), -0.005, 0.046, 0.05],
      [0.16, X(0.09), -0.008, 0.037, 0.04],
      [0.1, X(0.09), -0.01, 0.033, 0.035],
    ];
    const leg = loft(
      legRings.map(([y, x, z, rx, rz]) => hring([x, y, z], rx, rz)),
      { segments: 14 },
    );
    const tKnee = (0.68 - knee.y) / (0.68 - 0.1);
    const tAnkle = (0.68 - ankle.y) / (0.68 - 0.1);
    b.add(leg.geometry, {
      name: "leg",
      color: "#ffffff",
      tile: CELLS.skin,
      skin: chainBlend([upLeg, loLeg, foot], [tKnee, tAnkle], 0.07),
      param: leg.param,
    });

    const sock = loft(
      [hring([X(0.09), 0.155, -0.008], 0.041, 0.044), hring([X(0.09), 0.13, -0.009], 0.04, 0.043), hring([X(0.09), 0.08, -0.01], 0.039, 0.045)],
      { segments: 14, thickness: 0.004 },
    );
    b.add(sock.geometry, {
      name: "sock",
      // Ribbed cuff with one jade stripe, so the ankle does not dissolve into the shoe.
      color: (p) =>
        p.y > 0.128 && p.y < 0.139
          ? new THREE.Color(STUDENT_KIT.palette.shoeAccent)
          : white.clone().multiplyScalar(p.y > 0.139 && Math.sin(p.y * 900) > 0 ? 0.9 : 1),
      tile: swatch("sock"),
      skin: jointBlend(loLeg, foot, 0.5, 0.4),
      param: sock.param,
    });

    addShoe(b, ankle, side, foot);
  }
}

function addShoe(b: PartBuilder, ankle: THREE.Vector3, side: 1 | -1, foot: number) {
  const x0 = ankle.x;
  const rings: [number, number, number, number][] = [
    [-0.076, 0.05, 0.039, 0.042],
    [-0.058, 0.055, 0.046, 0.05],
    [-0.022, 0.058, 0.049, 0.054],
    [0.018, 0.051, 0.051, 0.046],
    [0.068, 0.043, 0.053, 0.037],
    [0.118, 0.037, 0.05, 0.031],
    [0.152, 0.033, 0.044, 0.026],
    [0.176, 0.031, 0.031, 0.02],
  ];
  const upper = loft(
    rings.map(([z, y, rx, ry]) => ({ center: [x0, y, z] as V3, ax: [1, 0, 0] as V3, ay: [0, 1, 0] as V3, rx, ry })),
    { segments: 16, capStart: true, capEnd: true },
  );
  b.add(upper.geometry, {
    name: "shoe-upper",
    color: (p) => white.clone().multiplyScalar(p.y < 0.03 ? 0.93 : 1),
    tile: CELLS.shoe,
    skin: foot,
    param: upper.param,
  });
  // Padded collar around the ankle opening.
  const collar = new THREE.TorusGeometry(0.043, 0.009, 6, 16);
  collar.rotateX(Math.PI / 2);
  collar.scale(1, 1, 1.12);
  collar.translate(x0, 0.104, -0.026);
  b.add(collar, { name: "shoe-collar", color: "#ffffff", tile: CELLS.shoe, skin: foot });
  const tongue = new RoundedBoxGeometry(0.05, 0.05, 0.012, 1, 0.005);
  tongue.rotateX(-0.45);
  tongue.translate(x0, 0.1, 0.008);
  b.add(tongue, { name: "shoe-tongue", color: "#ffffff", tile: swatch("tongue"), skin: foot });
  for (let i = 0; i < 4; i++) {
    const z = -0.008 + i * 0.022;
    const y = 0.083 - i * 0.0075;
    const lace = new THREE.BoxGeometry(0.056 - i * 0.003, 0.0045, 0.006);
    lace.rotateX(-0.3);
    lace.translate(x0, y + 0.006, z);
    b.add(lace, { name: "lace", color: "#b9c4c0", tile: swatch("lace"), skin: foot });
  }
  // Side stripe sweeping from heel to midfoot on both faces of the upper.
  for (const face of [-1, 1]) {
    const sx = (dz: number) => x0 + face * (0.047 + Math.sin(((dz + 0.06) / 0.16) * Math.PI) * 0.006);
    const stripe = sweep(
      [
        [sx(-0.06), 0.068, -0.06],
        [sx(-0.01), 0.058, -0.01],
        [sx(0.05), 0.042, 0.05],
        [sx(0.09), 0.036, 0.09],
      ],
      { width: (t) => 0.007 * (1 - t * 0.6), thickness: () => 0.0018, outward: [face, 0, 0], segments: 8, around: 6 },
    );
    b.add(stripe.geometry, { name: "shoe-stripe", color: "#ffffff", tile: swatch("accent"), skin: foot });
  }
  const heelTab = new RoundedBoxGeometry(0.03, 0.035, 0.01, 1, 0.004);
  heelTab.translate(x0, 0.085, -0.088);
  b.add(heelTab, { name: "heel-tab", color: "#ffffff", tile: swatch("accent"), skin: foot });

  // Sole: extruded foot outline, softly bevelled.
  const outline = new THREE.Shape();
  const hw = 0.047;
  outline.moveTo(-0.04, -0.083);
  outline.quadraticCurveTo(0, -0.098, 0.04, -0.083);
  outline.quadraticCurveTo(hw + 0.006, 0.02, hw + 0.006, 0.09);
  outline.quadraticCurveTo(hw, 0.188, 0, 0.193);
  outline.quadraticCurveTo(-hw, 0.188, -hw - 0.004, 0.09);
  outline.quadraticCurveTo(-hw - 0.002, 0.02, -0.04, -0.083);
  const sole = new ExtrudeGeometry(outline, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 6 });
  sole.rotateX(Math.PI / 2);
  sole.translate(x0, 0.024, 0);
  b.add(sole, { name: "sole", color: "#ffffff", tile: CELLS.sole, skin: foot, uvRepeat: [1, 1] });
  // Jade midsole stripe, the one accent that ties shoes to the jacket.
  const stripe = new ExtrudeGeometry(outline, { depth: 0.005, bevelEnabled: false, curveSegments: 6 });
  stripe.scale(1.012, 1.012, 1);
  stripe.rotateX(Math.PI / 2);
  stripe.translate(x0, 0.03, 0);
  b.add(stripe, { name: "midsole-stripe", color: "#ffffff", tile: swatch("accent"), skin: foot });
  void side;
}

export function roundTip(t: number) {
  return t < 0.72 ? 1 - t * 0.12 : Math.sqrt(Math.max(0.04, 1 - Math.pow((t - 0.72) / 0.28, 2))) * 0.92;
}

/** Normalised arc-length parameter of point `i` along a polyline of centres. */
function paramAt(points: V3[], i: number) {
  let total = 0;
  let upto = 0;
  for (let k = 1; k < points.length; k++) {
    const d = Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1], points[k][2] - points[k - 1][2]);
    total += d;
    if (k <= i) upto += d;
  }
  return upto / total;
}
