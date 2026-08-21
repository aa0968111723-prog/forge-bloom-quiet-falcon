/**
 * Skeletal character invariants.
 *
 * The rig and its clips are pure geometry/data, so they can be checked without
 * a browser. These guard the things that fail silently at runtime: a skin
 * weight that does not sum to 1 shears the mesh, a bone index past the end of
 * the skeleton renders garbage, and an animation track naming a bone that has
 * been renamed simply does nothing at all.
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { BONE_ORDER, buildBodyGeometry, buildRig } from "../src/game/character/rig.ts";
import {
  STRIDE_LENGTH,
  TIME_SCALE_RANGE,
  idleClip,
  runClip,
  walkClip,
} from "../src/game/character/clips.ts";

test("armature has the expected hierarchy", () => {
  const rig = buildRig();
  assert.equal(rig.skeleton.bones.length, BONE_ORDER.length);
  // Skeleton bone order must match BONE_ORDER, since skin indices are
  // resolved through that array.
  rig.skeleton.bones.forEach((bone, i) => assert.equal(bone.name, BONE_ORDER[i]));

  const parentOf = (name) => rig.bones[name].parent?.name ?? null;
  assert.equal(parentOf("hips"), null, "hips is the root");
  assert.equal(parentOf("spine"), "hips");
  assert.equal(parentOf("chest"), "spine");
  assert.equal(parentOf("head"), "neck");
  assert.equal(parentOf("lowerArmL"), "upperArmL");
  assert.equal(parentOf("footR"), "lowerLegR");

  // Rest pose must stand on the ground, not float or sink.
  rig.root.updateMatrixWorld(true);
  const foot = new THREE.Vector3().setFromMatrixPosition(rig.bones.footL.matrixWorld);
  assert.ok(foot.y > 0 && foot.y < 0.25, `ankle at y=${foot.y}`);
  const head = new THREE.Vector3().setFromMatrixPosition(rig.bones.head.matrixWorld);
  assert.ok(head.y > 1.3 && head.y < 1.6, `head at y=${head.y}`);
});

test("skinned geometry is fully and validly weighted", () => {
  const rig = buildRig();
  const geo = buildBodyGeometry(rig, "#1a3f6d");
  const index = geo.attributes.skinIndex;
  const weight = geo.attributes.skinWeight;
  assert.ok(index && weight, "geometry carries skinning attributes");
  assert.equal(index.count, geo.attributes.position.count);

  for (let i = 0; i < index.count; i++) {
    const sum = weight.getX(i) + weight.getY(i) + weight.getZ(i) + weight.getW(i);
    // A vertex whose weights do not sum to 1 collapses toward the origin.
    assert.ok(Math.abs(sum - 1) < 1e-4, `vertex ${i} weights sum to ${sum}`);
    for (const c of ["getX", "getY", "getZ", "getW"]) {
      const bone = index[c](i);
      assert.ok(
        Number.isInteger(bone) && bone >= 0 && bone < BONE_ORDER.length,
        `vertex ${i} references bone ${bone}`,
      );
    }
  }
  assert.ok(geo.attributes.color, "vertex colours present");
  assert.ok(geo.attributes.position.count > 400, "body has real geometry");
});

test("clips only drive bones that exist", () => {
  const rig = buildRig();
  const names = new Set(BONE_ORDER);
  for (const clip of [idleClip(), walkClip(), runClip()]) {
    assert.ok(clip.duration > 0, `${clip.name} has a duration`);
    assert.ok(clip.tracks.length > 0, `${clip.name} has tracks`);
    for (const track of clip.tracks) {
      const [bone, property] = track.name.split(".");
      assert.ok(names.has(bone), `${clip.name} drives unknown bone ${bone}`);
      assert.ok(
        property === "quaternion" || property === "position",
        `${clip.name} drives unexpected property ${property}`,
      );
      assert.ok(track.times.length >= 2, `${clip.name}/${track.name} needs keyframes`);
      // Times must be sorted and inside the clip.
      for (let i = 1; i < track.times.length; i++) {
        assert.ok(track.times[i] > track.times[i - 1], "keyframe times ascend");
      }
      assert.ok(track.times[track.times.length - 1] <= clip.duration + 1e-6);
    }
  }
  void rig;
});

test("quaternion tracks stay normalised", () => {
  for (const clip of [idleClip(), walkClip(), runClip()]) {
    for (const track of clip.tracks) {
      if (!track.name.endsWith(".quaternion")) continue;
      for (let i = 0; i < track.values.length; i += 4) {
        const [x, y, z, w] = track.values.slice(i, i + 4);
        const len = Math.hypot(x, y, z, w);
        // A denormalised quaternion scales the limb it drives.
        assert.ok(Math.abs(len - 1) < 1e-5, `${clip.name}/${track.name} |q|=${len}`);
      }
    }
  }
});

test("gait cycles loop seamlessly", () => {
  // First and last keyframe of a looping cycle must agree, or the character
  // snaps once per stride.
  for (const clip of [walkClip(), runClip()]) {
    for (const track of clip.tracks) {
      if (!track.name.endsWith(".quaternion")) continue;
      const n = track.values.length;
      for (let c = 0; c < 4; c++) {
        assert.ok(
          Math.abs(track.values[c] - track.values[n - 4 + c]) < 1e-6,
          `${clip.name}/${track.name} does not loop`,
        );
      }
    }
  }
});

test("walk and run stay in phase for blending", () => {
  // Both gaits must start with the same leg forward, or a cross-fade makes the
  // legs scissor through each other.
  const walk = walkClip();
  const run = runClip();
  const legTrack = (clip) => clip.tracks.find((t) => t.name === "upperLegL.quaternion");
  const w = legTrack(walk);
  const r = legTrack(run);
  assert.ok(w && r, "both gaits drive the left leg");
  // Compare the sign of the rotation a quarter-cycle in.
  const quarter = (track) => {
    const i = Math.floor(track.times.length / 4);
    return Math.sign(track.values[i * 4]); // quaternion x component
  };
  assert.equal(quarter(w), quarter(r), "gaits lead with the same leg");
});

test("cadence stays plausible across the controller's speed range", () => {
  // The controller walks at 4.6 m/s and sprints at 7.8 m/s.
  for (const [speed, stride] of [
    [1.5, STRIDE_LENGTH.walk],
    [4.6, STRIDE_LENGTH.walk],
    [7.8, STRIDE_LENGTH.run],
  ]) {
    const rate = Math.min(Math.max(speed / stride, TIME_SCALE_RANGE.min), TIME_SCALE_RANGE.max);
    // Faster than ~2.5 cycles/s reads as a blur; slower than ~0.5 as a moonwalk.
    assert.ok(rate >= 0.5 && rate <= 2.5, `speed ${speed} -> ${rate} cycles/s`);
  }
  assert.ok(STRIDE_LENGTH.run > STRIDE_LENGTH.walk, "running covers more ground per stride");
});
