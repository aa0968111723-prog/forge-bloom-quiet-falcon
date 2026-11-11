/**
 * Integration fixes on the M1 art runtime: head glance must not accumulate
 * when locomotion leaves the head untracked, and a cloned skeleton must drop
 * its bone texture without disposing shared geometry.
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { applyHeadLook, captureLookBase, createLookPose, restoreLookBase } from "../src/game/art/character/look.ts";
import { nextWindupProgress } from "../src/game/art/creatures/windup.ts";
import { disposeOwnedArt, skeletonsIn } from "../src/game/art/instance.ts";

test("head glance stays on the clip pose while gait clips leave the head alone", () => {
  const neck = new THREE.Bone();
  const head = new THREE.Bone();
  neck.name = "neck";
  head.name = "head";
  const neckClip = neck.quaternion.clone();
  const pose = createLookPose();
  let ready = false;
  const look = { yaw: 0.5, pitch: -0.2 };
  for (let frame = 0; frame < 40; frame++) {
    if (ready) restoreLookBase(neck, head, pose);
    neck.quaternion.copy(neckClip);
    captureLookBase(neck, head, pose);
    ready = true;
    applyHeadLook(neck, head, look);
  }
  const once = new THREE.Bone();
  applyHeadLook(new THREE.Bone(), once, look);
  const drifted = new THREE.Euler().setFromQuaternion(head.quaternion);
  const single = new THREE.Euler().setFromQuaternion(once.quaternion);
  assert.ok(Math.abs(drifted.y - single.y) < 1e-6, `head yaw drifted to ${drifted.y}`);
  assert.ok(Math.abs(drifted.x - single.x) < 1e-6, `head pitch drifted to ${drifted.x}`);
});

test("quiz windup graphic holds while the simulation is paused", () => {
  const duration = 0.9;
  const timer = 0.54;
  let visual = nextWindupProgress(0, timer, duration, 0, false);
  for (let i = 0; i < 40; i++) visual = nextWindupProgress(visual, timer, duration, 0.05, true);
  assert.equal(visual, 1 - timer / duration);
  const resumed = nextWindupProgress(visual, timer, duration, 0.05, false);
  assert.ok(resumed < 0.7, `paused windup ran ahead to ${resumed}`);
  const caught = nextWindupProgress(0.2, 0.09, duration, 0.016, false);
  assert.ok(caught >= 1 - 0.09 / duration);
});

test("disposing an art instance frees bone textures and keeps shared geometry", () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  let geometryDisposals = 0;
  const original = geometry.dispose.bind(geometry);
  geometry.dispose = () => {
    geometryDisposals += 1;
    original();
  };
  const bone = new THREE.Bone();
  const skeleton = new THREE.Skeleton([bone]);
  skeleton.computeBoneTexture();
  assert.ok(skeleton.boneTexture);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.skeleton = skeleton;
  mesh.add(bone);
  const root = new THREE.Group();
  root.add(mesh);
  const found = skeletonsIn(root);
  assert.deepEqual(found, [skeleton]);
  disposeOwnedArt([mesh.material], found);
  assert.equal(skeleton.boneTexture, null);
  assert.equal(geometryDisposals, 0);
  disposeOwnedArt([mesh.material], found);
  assert.equal(geometryDisposals, 0);
});
