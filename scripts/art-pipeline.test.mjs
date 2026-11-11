/**
 * Art pipeline and student kit invariants.
 *
 * Runs the real validator over the committed outputs, proves a fresh export is
 * byte-identical, feeds the GLB checker broken files to show it catches them,
 * and measures the kit itself: weights, joints, clip targets, loops, facing,
 * backpack clearance and foot slip at the controller's speeds.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { inspectGlb } from "./art/lib/glb.mjs";
import { checkGlb, rebuildCheck, validate } from "./art/validate-assets.mjs";
import { buildStudentKit } from "../art/characters/student-kit/kit.ts";
import { STRIDE } from "../art/characters/student-kit/clips.ts";
import { JACKET_RINGS } from "../art/characters/student-kit/body.ts";
import { WALK, SPRINT } from "../src/game/rpg/move.ts";

const KIT_RECORD = JSON.parse(readFileSync(new URL("../art/assets.json", import.meta.url))).assets.find(
  (a) => a.id === "char.student-kit",
);

test("committed art outputs validate with no errors", () => {
  const result = validate();
  assert.deepEqual(result.errors, []);
});

test("a fresh export reproduces the committed GLB byte for byte", async () => {
  const result = { errors: [] };
  await rebuildCheck(result);
  assert.deepEqual(result.errors, []);
});

test("the GLB checker rejects broken references, foreign channels and bad quaternions", () => {
  const fresh = () => inspectGlb(readFileSync(new URL("../public/game-art/characters/student-kit.glb", import.meta.url)));
  let info = fresh();
  info.json.animations[0].channels[0].target.node = 9999;
  assert.ok(checkGlb(info, KIT_RECORD).some((e) => e.includes("does not exist")));

  info = fresh();
  const meshNode = info.json.nodes.findIndex((n) => n.mesh !== undefined);
  info.json.animations[0].channels[0].target.node = meshNode;
  assert.ok(checkGlb(info, KIT_RECORD).some((e) => e.includes("not a skin joint")));

  info = fresh();
  assert.ok(checkGlb(info, { ...KIT_RECORD, animations: [...KIT_RECORD.animations, "cartwheel"] }).some((e) => e.includes("cartwheel")));

  info = fresh();
  const anim = info.json.animations[0];
  const rot = anim.channels.find((c) => c.target.path === "rotation");
  const acc = info.json.accessors[anim.samplers[rot.sampler].output];
  const view = info.json.bufferViews[acc.bufferView];
  info.bin.writeFloatLE(2, (view.byteOffset ?? 0) + (acc.byteOffset ?? 0));
  assert.ok(checkGlb(info, KIT_RECORD).some((e) => e.includes("non-unit quaternion")));
});

const kit = buildStudentKit();

test("kit skin weights sum to one and every joint index is a real bone", () => {
  const g = kit.mesh.geometry;
  const w = g.attributes.skinWeight;
  const j = g.attributes.skinIndex;
  for (let i = 0; i < w.count; i++) {
    const sum = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i);
    assert.ok(Math.abs(sum - 1) < 1e-6, `vertex ${i} weights sum to ${sum}`);
    for (const c of ["getX", "getY", "getZ", "getW"]) assert.ok(j[c](i) < kit.bones.length);
  }
  assert.ok(kit.triangles <= KIT_RECORD.budget.triangles, `${kit.triangles} triangles`);
});

test("the low-tier LOD shares skeleton and clips, stays weighted and under its budget", () => {
  const low = buildStudentKit(1);
  const lodRecord = JSON.parse(readFileSync(new URL("../art/assets.json", import.meta.url))).assets.find(
    (a) => a.id === "char.student-kit-lod1",
  );
  assert.deepEqual(low.bones, kit.bones);
  assert.deepEqual(
    low.clips.map((c) => c.name),
    kit.clips.map((c) => c.name),
  );
  assert.ok(low.triangles <= lodRecord.budget.triangles, `${low.triangles} triangles`);
  assert.ok(low.triangles < kit.triangles * 0.5, "LOD1 at least halves the hero mesh");
  const w = low.mesh.geometry.attributes.skinWeight;
  for (let i = 0; i < w.count; i++) {
    const sum = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i);
    assert.ok(Math.abs(sum - 1) < 1e-6);
  }
});

test("every clip drives only kit bones, with unit quaternions and seamless loops", () => {
  const names = new Set(kit.bones);
  for (const clip of kit.clips) {
    for (const track of clip.tracks) {
      const [bone] = track.name.split(".");
      assert.ok(names.has(bone), `${clip.name} drives unknown bone ${bone}`);
      if (!track.name.endsWith(".quaternion")) continue;
      for (let i = 0; i < track.values.length; i += 4) {
        const len = Math.hypot(...track.values.slice(i, i + 4));
        assert.ok(Math.abs(len - 1) < 1e-5, `${clip.name}/${track.name}`);
      }
      if (["idle", "walk", "run"].includes(clip.name)) {
        const n = track.values.length;
        const first = track.values.slice(0, 4);
        const last = track.values.slice(n - 4);
        const dot = Math.abs(first.reduce((s, v, k) => s + v * last[k], 0));
        assert.ok(dot > 1 - 1e-6, `${clip.name}/${track.name} does not loop`);
      }
    }
  }
  for (const action of ["attack", "skill", "dodge", "hurt", "interact"]) {
    assert.ok(kit.clips.some((c) => c.name === action), `missing ${action}`);
  }
});

/** Pose the rig with one clip and read a bone's world position. */
function sampler(clipName) {
  const scene = kit.scene.clone(true);
  const mesh = scene.getObjectByName("student");
  const mixer = new THREE.AnimationMixer(scene);
  const clip = kit.clips.find((c) => c.name === clipName);
  const action = mixer.clipAction(clip);
  action.play();
  return {
    clip,
    at(t, bone) {
      mixer.setTime(t);
      scene.updateMatrixWorld(true);
      return new THREE.Vector3().setFromMatrixPosition(mesh.parent.getObjectByName(bone).matrixWorld);
    },
  };
}

test("walk and run lead with the same leg so the cross-fade never scissors", () => {
  const walk = sampler("walk");
  const run = sampler("run");
  const lead = (s) => Math.sign(s.at(s.clip.duration * 0.25, "footL").z - s.at(s.clip.duration * 0.25, "footR").z);
  assert.equal(lead(walk), lead(run));
});

test("the face looks forward (+Z) and the backpack clears the jacket at rest", () => {
  const head = kit.scene.getObjectByName("head");
  head.updateWorldMatrix(true, false);
  const pos = kit.mesh.geometry.attributes.position;
  const uv = kit.mesh.geometry.attributes.uv;
  // Face-cell vertices (atlas top-left 256 px) must sit in front of the skull centre.
  let front = 0;
  let count = 0;
  for (let i = 0; i < pos.count; i++) {
    if (uv.getX(i) < 0.5 && uv.getY(i) < 0.5) {
      count++;
      if (pos.getZ(i) > 0) front++;
    }
  }
  assert.ok(count > 100 && front / count > 0.98, `face texels on front: ${front}/${count}`);
  // Backpack front face vs the jacket's outer back surface over the bag's height.
  const bag = new THREE.Vector3();
  kit.scene.getObjectByName("bag").getWorldPosition(bag);
  const bagFront = bag.z + 0.065;
  for (const [y, , rz, zc] of JACKET_RINGS) {
    if (y < bag.y - 0.165 || y > bag.y + 0.165) continue;
    const jacketBack = zc - rz;
    assert.ok(bagFront < jacketBack - 0.005, `at y=${y} bag front ${bagFront.toFixed(3)} vs jacket back ${jacketBack.toFixed(3)}`);
  }
});

/**
 * Foot slip: in-place gait, so during stance the planted foot should move
 * backward at ground speed. Measure the stance foot's speed relative to the
 * hips at the controller's walk and sprint speeds with the runtime cadence.
 */
export function footSlip(clipName, groundSpeed, stride) {
  const s = sampler(clipName);
  const rate = Math.min(2.4, Math.max(0.55, groundSpeed / stride));
  const n = 120;
  const samples = [];
  for (let i = 0; i <= n; i++) {
    const t = (s.clip.duration * i) / n;
    samples.push({ t, foot: s.at(t, "footL"), hips: s.at(t, "hips") });
  }
  const minY = Math.min(...samples.map((x) => x.foot.y));
  const speeds = [];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].foot.y > minY + 0.015) continue;
    const dz = samples[i].foot.z - samples[i].hips.z - (samples[i - 1].foot.z - samples[i - 1].hips.z);
    speeds.push((-dz / (samples[i].t - samples[i - 1].t)) * rate);
  }
  const footSpeed = speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length);
  return { footSpeed, groundSpeed, slip: Math.abs(groundSpeed - footSpeed) / groundSpeed };
}

test("foot slip at walk and sprint speed stays under 15 %", () => {
  const walk = footSlip("walk", WALK, STRIDE.walk);
  const run = footSlip("run", SPRINT, STRIDE.run);
  console.log(`foot slip: walk ${(walk.slip * 100).toFixed(1)} % (${walk.footSpeed.toFixed(2)} vs ${WALK} m/s), run ${(run.slip * 100).toFixed(1)} % (${run.footSpeed.toFixed(2)} vs ${SPRINT} m/s)`);
  assert.ok(walk.slip < 0.15, `walk slip ${walk.slip}`);
  assert.ok(run.slip < 0.15, `run slip ${run.slip}`);
});
