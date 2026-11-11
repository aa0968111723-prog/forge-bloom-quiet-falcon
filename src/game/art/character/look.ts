import * as THREE from "three";

/**
 * Head and neck glance, applied on top of the clip pose.
 *
 * Walk and run do not animate `head`. Once idle's weight hits zero the mixer
 * stops writing that bone, so adding the look offset in place every frame
 * twists the head without bound. Restore the pose captured after the last
 * clip update, let the mixer and one-shots write a clean pose, then apply
 * the glance once.
 */
export type LookPose = {
  neck: THREE.Quaternion;
  head: THREE.Quaternion;
};

export function createLookPose(): LookPose {
  return { neck: new THREE.Quaternion(), head: new THREE.Quaternion() };
}

export function restoreLookBase(neck: THREE.Object3D, head: THREE.Object3D, pose: LookPose) {
  neck.quaternion.copy(pose.neck);
  head.quaternion.copy(pose.head);
}

export function captureLookBase(neck: THREE.Object3D, head: THREE.Object3D, pose: LookPose) {
  pose.neck.copy(neck.quaternion);
  pose.head.copy(head.quaternion);
}

export function applyHeadLook(
  neck: THREE.Object3D,
  head: THREE.Object3D,
  look: { yaw: number; pitch: number },
) {
  neck.rotation.y += look.yaw * 0.45;
  neck.rotation.x += look.pitch * 0.5;
  head.rotation.y += look.yaw * 0.55;
  head.rotation.x += look.pitch * 0.5;
}
