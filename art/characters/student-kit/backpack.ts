/**
 * Canvas backpack with shoulder straps and the small turtle charm.
 *
 * The bag rides the `bag` bone (child of chest) and stops 1 cm behind the
 * jacket, so it never clips the back at rest; straps follow the jacket's
 * outer surface over the shoulders and down the chest. The charm hangs from
 * the pocket zipper on its own `charm` bone so it can swing.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PartBuilder, V3 } from "../../shared/builder.ts";
import { dome, sweep } from "../../shared/loft.ts";
import { CELLS, swatch } from "./atlas.ts";
import { onJacket } from "./body.ts";
import type { KitRig } from "./skeleton.ts";
import { STUDENT_KIT } from "./spec.ts";

export function addBackpack(b: PartBuilder, rig: KitRig) {
  const bagBone = rig.index("bag");
  const chest = rig.index("chest");
  const charmBone = rig.index("charm");
  const o = rig.at("bag");
  const at = (x: number, y: number, z: number): V3 => [o.x + x, o.y + y, o.z + z];

  const box = (name: string, size: V3, p: V3, round: number, tile = CELLS.canvas, color = "#ffffff", rot: V3 = [0, 0, 0]) => {
    const g = round > 0.004 ? new RoundedBoxGeometry(size[0], size[1], size[2], size[0] > 0.2 ? 2 : 1, round) : new THREE.BoxGeometry(size[0], size[1], size[2]);
    g.rotateX(rot[0]);
    g.rotateY(rot[1]);
    g.rotateZ(rot[2]);
    g.translate(...p);
    b.add(g, { name, color, tile, skin: bagBone });
  };

  box("bag-body", [0.27, 0.33, 0.13], at(0, 0, 0), 0.04);
  box("bag-flap", [0.255, 0.105, 0.03], at(0, 0.122, -0.052), 0.014, CELLS.canvas, "#d9cbb3", [0.32, 0, 0]);
  box("bag-pocket", [0.2, 0.15, 0.045], at(0, -0.06, -0.078), 0.02, CELLS.canvas, "#efe6d6");
  box("bag-zip", [0.17, 0.006, 0.006], at(0, 0.0, -0.101), 0, swatch("shadow"));
  box("bag-pull", [0.011, 0.022, 0.005], at(0.07, -0.002, -0.104), 0, CELLS.metal);
  for (const side of [-1, 1]) {
    box("bag-side-pocket", [0.032, 0.12, 0.092], at(side * 0.146, -0.085, 0), 0.012, CELLS.canvas, "#e4d8c3");
    // Stitched edge binding down each side of the pocket.
    box("bag-binding", [0.008, 0.15, 0.048], at(side * 0.1, -0.06, -0.079), 0, CELLS.strap);
  }
  const handle = sweep([at(-0.045, 0.162, 0.0), at(0, 0.198, 0.0), at(0.045, 0.162, 0.0)], {
    width: () => 0.009,
    thickness: () => 0.005,
    outward: [0, 0, 1],
    segments: 6,
    around: 8,
  });
  b.add(handle.geometry, { name: "bag-handle", color: "#ffffff", tile: CELLS.strap, skin: bagBone });

  // Shoulder straps over the jacket, buckled on the chest.
  for (const side of [-1, 1]) {
    const x = (v: number) => side * v;
    const path: V3[] = [
      [x(0.072), o.y + 0.15, o.z + 0.06],
      [x(0.094), 1.272, -0.03],
      onJacket(x(0.1), 1.205, true, 0.007),
      onJacket(x(0.108), 1.12, true, 0.007),
      onJacket(x(0.122), 1.04, true, 0.007),
      onJacket(x(0.165), 0.985, true, 0.01),
      [x(0.12), o.y - 0.16, o.z + 0.06],
    ];
    const strap = sweep(path, {
      width: () => 0.017,
      thickness: () => 0.0035,
      outward: (t) => (t < 0.18 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(x(0.35), 0, 1).normalize()),
      segments: 22,
      around: 8,
    });
    b.add(strap.geometry, { name: "strap", color: "#ffffff", tile: CELLS.strap, skin: chest });
    const buckle = new THREE.BoxGeometry(0.04, 0.022, 0.008);
    const bp = onJacket(x(0.112), 1.085, true, 0.012);
    buckle.rotateY(x(0.35));
    buckle.translate(...bp);
    b.add(buckle, { name: "buckle", color: "#ffffff", tile: CELLS.metal, skin: chest });
  }

  addTurtleCharm(b, rig.at("charm"), charmBone);
}

/**
 * Turtle charm, ~7 cm: domed scute shell, pale plastron, head, flippers and
 * tail, hanging head-up with its shell facing away from the bag.
 */
function addTurtleCharm(b: PartBuilder, pivot: THREE.Vector3, bone: number) {
  const P = STUDENT_KIT.palette;
  // Local frame: +Y toward the head, +Z out of the shell (world -Z).
  const toWorld = new THREE.Matrix4()
    .makeRotationY(Math.PI)
    .setPosition(pivot.x, pivot.y - 0.078, pivot.z - 0.01);
  const place = (g: THREE.BufferGeometry) => g.applyMatrix4(toWorld);

  const cord = sweep(
    [
      [pivot.x, pivot.y, pivot.z - 0.002],
      [pivot.x + 0.001, pivot.y - 0.02, pivot.z - 0.006],
      [pivot.x, pivot.y - 0.04, pivot.z - 0.01],
    ],
    { width: () => 0.0018, thickness: () => 0.0018, outward: [0, 0, -1], segments: 4, around: 6 },
  );
  b.add(cord.geometry, { name: "charm-cord", color: "#ffffff", tile: swatch("cord"), skin: bone });
  const ring = new THREE.TorusGeometry(0.006, 0.0016, 6, 12);
  ring.rotateY(Math.PI / 2);
  ring.translate(pivot.x, pivot.y - 0.002, pivot.z - 0.002);
  b.add(ring, { name: "charm-ring", color: "#ffffff", tile: CELLS.metal, skin: bone });

  const shell = dome(0.027, 0.017, 0.033, 6, 16);
  // Dome is built along +Y; turn it so it bulges out of the shell plane (+Z).
  shell.geometry.rotateX(Math.PI / 2);
  b.add(place(shell.geometry), { name: "turtle-shell", color: "#ffffff", tile: CELLS.turtle, skin: bone });
  const belly = new THREE.CylinderGeometry(0.026, 0.026, 0.006, 16);
  belly.rotateX(Math.PI / 2);
  belly.scale(1, 1.22, 1);
  b.add(place(belly), { name: "turtle-plastron", color: "#ffffff", tile: swatch("turtleBelly"), skin: bone });
  const skin = new THREE.Color(P.turtleSkin).getStyle();
  const headG = new THREE.SphereGeometry(0.0115, 10, 8);
  headG.scale(1, 1.15, 0.95);
  headG.translate(0, 0.04, 0.004);
  b.add(place(headG), { name: "turtle-head", color: skin, tile: swatch("white"), skin: bone });
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.0022, 6, 5);
    eye.translate(sx * 0.0055, 0.045, 0.0125);
    b.add(place(eye), { name: "turtle-eye", color: "#ffffff", tile: swatch("eyeDot"), skin: bone });
    for (const sy of [-1, 1]) {
      const flipper = new THREE.SphereGeometry(1, 8, 6);
      flipper.scale(0.016, 0.008, 0.0045);
      flipper.rotateZ(sx * sy * 0.6 + (sy > 0 ? 0 : sx * 0.3));
      flipper.translate(sx * 0.027, sy * 0.021, 0.001);
      b.add(place(flipper), { name: "turtle-flipper", color: skin, tile: swatch("white"), skin: bone });
    }
  }
  const tailG = new THREE.ConeGeometry(0.004, 0.012, 6);
  tailG.rotateZ(Math.PI);
  tailG.translate(0, -0.038, 0.001);
  b.add(place(tailG), { name: "turtle-tail", color: skin, tile: swatch("white"), skin: bone });
}
