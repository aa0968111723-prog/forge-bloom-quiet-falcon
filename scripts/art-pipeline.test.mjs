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

// ---------------------------------------------------------------- NPC kit

const { buildNpcKit } = await import("../art/characters/npc-kit/kit.ts");
const { NPC_PARTS } = await import("../art/characters/npc-kit/parts.ts");
const { NPC_ROSTER } = await import("../art/characters/npc-kit/roster.ts");
const { mergeGeometries } = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
const npc = buildNpcKit();
const npcMeshes = [];
npc.scene.traverse((o) => o.isSkinnedMesh && npcMeshes.push(o));

test("NPC parts share one skeleton, weights sum to one, tint slots are known", () => {
  const skeleton = npcMeshes[0].skeleton;
  assert.equal(npcMeshes.length, NPC_PARTS.length);
  for (const mesh of npcMeshes) {
    assert.equal(mesh.skeleton, skeleton, `${mesh.name} has its own skeleton`);
    const g = mesh.geometry;
    const w = g.attributes.skinWeight;
    const j = g.attributes.skinIndex;
    for (let i = 0; i < w.count; i++) {
      assert.ok(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 0.01, `${mesh.name} vertex ${i} weights`);
      for (const k of [j.getX(i), j.getY(i), j.getZ(i), j.getW(i)]) assert.ok(k < skeleton.bones.length);
    }
    const color = g.attributes.color.array;
    for (let i = 3; i < color.length; i += 4) assert.ok(color[i] === 255 || (color[i] >= 1 && color[i] <= 11), `${mesh.name} slot ${color[i]}`);
  }
});

test("every roster preset is a complete, distinct person under budget that merges into one mesh", () => {
  const ids = new Set(NPC_PARTS.map((p) => p.id));
  const npcsSource = readFileSync(new URL("../src/game/Npcs.tsx", import.meta.url), "utf8");
  const roster = JSON.parse(npcsSource.match(/const ROSTER = (\[[^\]]*\])/)[1]);
  assert.deepEqual(roster, NPC_ROSTER.map((p) => p.id), "Npcs.tsx walkers and roster presets differ");
  const paths = (npcsSource.match(/const PATHS[\s\S]*?\n\];/)[0].match(/\/\/ /g) ?? []).length;
  assert.equal(paths, NPC_ROSTER.length, "one preset per walking path");
  for (const preset of NPC_ROSTER) {
    for (const part of preset.parts) assert.ok(ids.has(part), `${preset.id}: unknown part ${part}`);
    for (const slot of ["head", "hair", "top", "bottom", "shoes"]) {
      assert.equal(preset.parts.filter((p) => p.startsWith(`${slot}:`)).length, 1, `${preset.id} needs exactly one ${slot}`);
    }
    assert.ok(npc.presetTriangles[preset.id] <= 10000, `${preset.id}: ${npc.presetTriangles[preset.id]} triangles`);
    const merged = mergeGeometries(preset.parts.map((id) => npcMeshes.find((m) => m.name === `part_${id.replace(/[^A-Za-z0-9-]/g, "_")}`).geometry));
    assert.ok(merged, `${preset.id} parts cannot be merged`);
  }
  for (let a = 0; a < NPC_ROSTER.length; a++) {
    for (let b = a + 1; b < NPC_ROSTER.length; b++) {
      const A = new Set(NPC_ROSTER[a].parts);
      const differing = NPC_ROSTER[b].parts.filter((p) => !A.has(p)).length + NPC_ROSTER[a].parts.filter((p) => !NPC_ROSTER[b].parts.includes(p)).length;
      assert.ok(differing >= 4, `${NPC_ROSTER[a].id} and ${NPC_ROSTER[b].id} differ in only ${differing} parts`);
    }
  }
});

// ---------------------------------------------------------------- creatures

const creatures = {
  quiz: (await import("../art/creatures/quiz/quiz.ts")).buildQuiz(),
  report: (await import("../art/creatures/report/report.ts")).buildReport(),
  exam: (await import("../art/creatures/exam/exam.ts")).buildExam(),
  final: (await import("../art/creatures/final/final.ts")).buildFinal(),
};

test("every creature has the six state clips; strikes return to rest and defeats collapse", () => {
  for (const [kind, c] of Object.entries(creatures)) {
    const mesh = c.scene.getObjectByProperty("isSkinnedMesh", true);
    const bones = new Set(mesh.skeleton.bones.map((b) => b.name));
    const names = c.clips.map((x) => x.name).sort();
    assert.deepEqual(names, ["attack", "chase", "defeat", "hurt", "idle", "windup"], kind);
    for (const clip of c.clips) {
      for (const track of clip.tracks) {
        assert.ok(bones.has(track.name.split(".")[0]), `${kind}/${clip.name} drives unknown ${track.name}`);
        if (track.name.endsWith(".quaternion")) {
          for (let i = 0; i < track.values.length; i += 4) {
            const v = track.values;
            assert.ok(Math.abs(Math.hypot(v[i], v[i + 1], v[i + 2], v[i + 3]) - 1) < 1e-4, `${kind}/${clip.name} quaternion`);
          }
        }
      }
      const loop = clip.name === "idle" || clip.name === "chase";
      const endsAtRest = clip.name === "attack" || clip.name === "hurt";
      for (const track of clip.tracks.filter((t) => t.name.endsWith(".quaternion"))) {
        const v = track.values;
        const n = v.length;
        if (loop) {
          const d = Math.abs(v[0] * v[n - 4] + v[1] * v[n - 3] + v[2] * v[n - 2] + v[3] * v[n - 1]);
          assert.ok(d > 0.9999, `${kind}/${clip.name} ${track.name} loop seam`);
        }
        if (endsAtRest) assert.ok(Math.abs(v[n - 1]) > 0.9999, `${kind}/${clip.name} ${track.name} does not return to rest`);
      }
    }
    const defeat = c.clips.find((x) => x.name === "defeat");
    const scale = defeat.tracks.find((t) => t.name.endsWith(".scale"));
    assert.ok(scale && scale.values[scale.values.length - 1] <= 0.5, `${kind} defeat does not collapse`);
  }
});

/** Front-view coverage mask, normalised to the creature's own height (shape, not size). */
function frontSilhouette(mesh, n = 40) {
  const g = mesh.geometry;
  g.computeBoundingBox();
  const b = g.boundingBox;
  const h = b.max.y - b.min.y;
  const cx = (b.max.x + b.min.x) / 2;
  const pos = g.attributes.position;
  const idx = g.index.array;
  const grid = new Uint8Array(n * n);
  const to = (i) => [((pos.getX(i) - cx) / h + 0.75) / 1.5 * n, ((pos.getY(i) - b.min.y) / h) * n];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, c, d] = [to(idx[t]), to(idx[t + 1]), to(idx[t + 2])];
    const area = (c[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (c[1] - a[1]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], c[0], d[0])));
    const x1 = Math.min(n - 1, Math.ceil(Math.max(a[0], c[0], d[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], c[1], d[1])));
    const y1 = Math.min(n - 1, Math.ceil(Math.max(a[1], c[1], d[1])));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((c[0] - px) * (d[1] - py) - (d[0] - px) * (c[1] - py)) / area;
        const w1 = ((d[0] - px) * (a[1] - py) - (a[0] - px) * (d[1] - py)) / area;
        if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) grid[y * n + x] = 1;
      }
    }
  }
  return grid;
}

test("each creature has its own silhouette, not a recolour", () => {
  const size = {};
  const mask = {};
  for (const [kind, c] of Object.entries(creatures)) {
    const mesh = c.scene.getObjectByProperty("isSkinnedMesh", true);
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    const s = b.getSize(new THREE.Vector3());
    size[kind] = { w: s.x, h: s.y, minY: b.min.y };
    mask[kind] = frontSilhouette(mesh);
  }
  assert.ok(size.quiz.minY > 0.25, `quiz should float clear of the ground ${JSON.stringify(size.quiz)}`);
  assert.ok(size.report.w / size.report.h > 1.3, `report should be wide and squat ${JSON.stringify(size.report)}`);
  assert.ok(size.exam.h > 2.2 && size.exam.h / size.exam.w > 1.5, `exam should be tall and narrow ${JSON.stringify(size.exam)}`);
  assert.ok(size.final.w > 2.5 && size.final.h > 2.6, `final should be the biggest ${JSON.stringify(size.final)}`);
  const kinds = Object.keys(mask);
  for (let a = 0; a < kinds.length; a++) {
    for (let b = a + 1; b < kinds.length; b++) {
      let both = 0;
      let either = 0;
      for (let i = 0; i < mask[kinds[a]].length; i++) {
        both += mask[kinds[a]][i] & mask[kinds[b]][i];
        either += mask[kinds[a]][i] | mask[kinds[b]][i];
      }
      const iou = both / either;
      assert.ok(iou < 0.7, `${kinds[a]} and ${kinds[b]} front silhouettes overlap ${iou.toFixed(2)} after height normalisation`);
    }
  }
});
