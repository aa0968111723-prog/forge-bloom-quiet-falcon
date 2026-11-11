/**
 * Dark chestnut hair in separated clumps, with a small tied tail.
 *
 * A thin cap covers the scalp down to a hairline that is high at the
 * forehead and low at the nape. Over it sit lens-section clumps — bangs swept
 * to the character's left, side locks framing the face, back locks to the
 * nape and a few crown strands — so the silhouette breaks into strands
 * instead of reading as a helmet. The tail and its tie hang from the
 * `hairTail` bone so the runtime can sway it.
 */
import * as THREE from "three";
import type { PartBuilder, V3 } from "../../shared/builder.ts";
import { sweep } from "../../shared/loft.ts";
import { CELLS, swatch } from "./atlas.ts";
import type { KitRig } from "./skeleton.ts";
import { STUDENT_KIT } from "./spec.ts";
import { lod } from "./detail.ts";

const DEG = Math.PI / 180;

export function skullCenter(rig: KitRig) {
  return rig.at("head").add(new THREE.Vector3(...(STUDENT_KIT.head.center as unknown as V3)));
}

/** A point on (or `dr` metres outside) the deformed skull, by azimuth and polar angle. */
export function headPoint(rig: KitRig, phi: number, alpha: number, dr: number): V3 {
  const c = skullCenter(rig);
  const [rx, ry, rz] = STUDENT_KIT.head.radius as unknown as V3;
  let x = Math.sin(alpha) * Math.sin(phi);
  let y = Math.cos(alpha);
  let z = Math.sin(alpha) * Math.cos(phi);
  if (y < 0) {
    const k = Math.pow(-y, 1.55);
    x *= 1 - 0.36 * k;
    z *= 1 - 0.2 * k;
    y *= 1 + 0.05 * k;
  }
  z *= z > 0 ? 0.95 : 1.05;
  return [c.x + x * (rx + dr), c.y + y * (ry + dr), c.z + z * (rz + dr)];
}

function outwardFrom(rig: KitRig) {
  const c = skullCenter(rig);
  return (p: V3) => new THREE.Vector3(p[0] - c.x, p[1] - c.y, p[2] - c.z).normalize();
}

/** Hairline polar angle by azimuth: forehead high, nape low. */
function hairline(phi: number) {
  const back = (1 - Math.cos(phi)) / 2;
  return (62 + 63 * Math.pow(back, 0.85)) * DEG;
}

export function addHair(b: PartBuilder, rig: KitRig) {
  const head = rig.index("head");
  const tailBone = rig.index("hairTail");
  const out = outwardFrom(rig);

  // Scalp cap.
  const cols = lod(36, 22);
  const rows = lod(10, 6);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const phi = (c / cols) * Math.PI * 2;
      const s = r / rows;
      const p = headPoint(rig, phi, s * hairline(phi), 0.011 - s * 0.004);
      pos.push(...p);
      uv.push(c / cols, 0.18 + s * 0.42);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * (cols + 1) + c;
      const j = i + cols + 1;
      idx.push(i, i + 1, j, i + 1, j + 1, j);
    }
  }
  const cap = new THREE.BufferGeometry();
  cap.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  cap.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  cap.setIndex(idx);
  cap.computeVertexNormals();
  // Make sure the cap faces outward.
  const n0 = new THREE.Vector3().fromBufferAttribute(cap.attributes.normal as THREE.BufferAttribute, cols + 5);
  const p0 = new THREE.Vector3().fromBufferAttribute(cap.attributes.position as THREE.BufferAttribute, cols + 5);
  if (n0.dot(p0.sub(skullCenter(rig))) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    cap.setIndex(idx);
    cap.computeVertexNormals();
  }
  b.add(cap, { name: "hair-cap", color: "#ffffff", tile: CELLS.hair, skin: head });

  const clump = (name: string, points: V3[], width: number, thickness: number, bone: number, shade = 1) => {
    const lofted = sweep(points, {
      width: (t) => width * Math.pow(1 - t, 0.75) * (t < 0.12 ? 0.7 + t * 2.5 : 1),
      thickness: (t) => thickness * (1 - t * 0.85),
      outward: (t) => {
        const i = Math.min(points.length - 1, Math.round(t * (points.length - 1)));
        return out(points[i]);
      },
      segments: lod(8, 5),
      around: lod(6, 4),
    });
    b.add(lofted.geometry, {
      name,
      color: new THREE.Color(shade, shade, shade).getStyle(),
      tile: CELLS.hair,
      skin: bone,
    });
  };

  // Bangs, swept toward the character's left (+phi).
  for (let i = 0; i < 9; i++) {
    const phi = -0.94 + i * 0.235;
    const centre = 1 - Math.abs(i - 4) / 4;
    const sweepTo = 0.13 + 0.05 * centre;
    const tipAlpha = (79 + 7 * centre - (i === 8 ? 4 : 0) + (i % 2) * 2.5) * DEG;
    clump(
      "bang",
      [
        headPoint(rig, phi, 22 * DEG, -0.004),
        headPoint(rig, phi + sweepTo * 0.2, 48 * DEG, 0.017),
        headPoint(rig, phi + sweepTo * 0.65, 68 * DEG, 0.019),
        headPoint(rig, phi + sweepTo, tipAlpha, 0.013),
      ],
      0.038 - 0.006 * (1 - centre),
      0.01,
      head,
      i % 2 ? 0.93 : 1,
    );
  }
  // Side locks framing the face, down to the jaw.
  for (const side of [-1, 1]) {
    for (const [k, phi0] of [1.18, 1.44].entries()) {
      const phi = side * phi0;
      const toward = -side * (0.1 + k * 0.06);
      clump(
        "side-lock",
        [
          headPoint(rig, phi, 42 * DEG, -0.002),
          headPoint(rig, phi + toward * 0.2, 74 * DEG, 0.015),
          headPoint(rig, phi + toward * 0.6, 100 * DEG, 0.014),
          headPoint(rig, phi + toward, (117 + k * 6) * DEG, 0.011),
        ],
        0.036,
        0.011,
        head,
        k ? 0.92 : 1,
      );
    }
  }
  // Back locks to the nape, alternate tips flicking out.
  for (let i = 0; i < 9; i++) {
    const phi = Math.PI - 0.98 + i * 0.245;
    const flick = i % 2 ? 0.03 : 0.012;
    clump(
      "back-lock",
      [
        headPoint(rig, phi, 28 * DEG, -0.003),
        headPoint(rig, phi, 72 * DEG, 0.02),
        headPoint(rig, phi, 112 * DEG, 0.022),
        headPoint(rig, phi + (i - 4) * 0.02, (136 + (i % 3) * 3) * DEG, flick),
      ],
      0.036,
      0.012,
      head,
      i % 2 ? 0.9 : 1,
    );
  }
  // Crown strands break up the cap's smooth top.
  for (let i = 0; i < lod(6, 0); i++) {
    const phi = 0.3 + i * 1.05;
    clump(
      "crown",
      [headPoint(rig, phi, 4 * DEG, 0.004), headPoint(rig, phi, 20 * DEG, 0.018), headPoint(rig, phi + 0.15, 40 * DEG, 0.015)],
      0.03,
      0.008,
      head,
      0.96,
    );
  }
  // One stray strand on top.
  const top = headPoint(rig, 0.4, 9 * DEG, 0.004);
  clump(
    "ahoge",
    [top, [top[0], top[1] + 0.034, top[2] + 0.004], [top[0] + 0.008, top[1] + 0.05, top[2] + 0.024], [top[0] + 0.012, top[1] + 0.044, top[2] + 0.046]],
    0.0075,
    0.003,
    head,
    0.9,
  );

  // Small tied tail on the hairTail bone.
  const tail = rig.at("hairTail");
  const dir = new THREE.Vector3(0, -0.45, -1).normalize();
  const tie = new THREE.TorusGeometry(0.017, 0.0065, lod(6, 4), lod(12, 8));
  tie.lookAt(dir);
  tie.translate(tail.x, tail.y - 0.004, tail.z - 0.012);
  b.add(tie, { name: "hair-tie", color: "#ffffff", tile: swatch("hairTie"), skin: tailBone });
  for (const [i, dx] of [-0.012, -0.004, 0.004, 0.012].entries()) {
    const o: V3 = [tail.x + dx * 0.4, tail.y - 0.004, tail.z - 0.012];
    clump(
      "tail",
      [o, [o[0] + dx, o[1] - 0.018, o[2] - 0.04], [o[0] + dx * 1.6, o[1] - 0.062, o[2] - 0.066], [o[0] + dx * 2.1, o[1] - 0.1, o[2] - 0.058]],
      0.021 - Math.abs(dx) * 0.4,
      0.012,
      tailBone,
      i % 2 ? 0.92 : 1,
    );
  }
}
