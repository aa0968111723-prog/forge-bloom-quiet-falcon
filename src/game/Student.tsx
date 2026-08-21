import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildBodyGeometry, buildRig, type Rig } from "./character/rig";
import { useCharacterAnimation } from "./character/useCharacterAnimation";

type StudentProps = {
  speed?: number;
  speedRef?: { current: number };
  accent?: string;
  castShadow?: boolean;
  /** Head yaw/pitch offset in radians, relative to the body's facing. */
  lookRef?: { current: { yaw: number; pitch: number } };
};

/**
 * A Tamkang student: a genuinely skinned character on a code-authored
 * armature, animated by an AnimationMixer blending idle / walk / run by speed.
 *
 * The character is assembled **imperatively** and mounted as a single
 * `<primitive>`. That is not a style choice: three's `SkinnedMesh` dereferences
 * `this.skeleton` while updating its world matrix, so a mesh that is mounted
 * first and bound in an effect throws on its very first frame. Building it
 * complete before React ever sees it is the only correct order.
 *
 * Head, hair, face and backpack are parented to the `head` / `chest` bones
 * rather than skinned — they move rigidly with their bone, which is exactly
 * right for parts that never deform.
 *
 * The props API is unchanged, so Player and Npcs did not have to move.
 */
const FACE_CACHE = new Map<string, THREE.CanvasTexture>();

function faceTexture(): THREE.CanvasTexture {
  const hit = FACE_CACHE.get("face");
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#e9c9a8";
    ctx.fillRect(0, 0, 128, 128);
    for (const sx of [-1, 1]) {
      const x = 64 + sx * 20;
      ctx.fillStyle = "#232025";
      ctx.beginPath();
      ctx.ellipse(x, 66, 7.5, 10.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x - 2.4, 62, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#4a3a30";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(x, 56, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.strokeStyle = "#a3654d";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(64, 84, 8, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    ctx.fillStyle = "rgba(228, 130, 110, 0.28)";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(64 + sx * 30, 80, 7, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  FACE_CACHE.set("face", t);
  return t;
}

const HAIR_COLOR = "#2b2320";

/** Head dressing: face sphere, hair cap, fringe tufts, side hair. */
function buildHeadDressing(face: THREE.CanvasTexture, castShadow: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0, 0.1, 0);
  const hair = new THREE.MeshStandardMaterial({ color: HAIR_COLOR, roughness: 0.6 });

  const faceMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 18, 16),
    new THREE.MeshStandardMaterial({ map: face, roughness: 0.55 }),
  );
  // Sphere UVs put canvas-centre content at +X; turn it to face +Z.
  faceMesh.rotation.y = -Math.PI / 2;
  faceMesh.castShadow = castShadow;
  group.add(faceMesh);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.157, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hair,
  );
  cap.position.set(0, 0.055, -0.035);
  cap.castShadow = castShadow;
  group.add(cap);

  for (const k of [-1, 0, 1]) {
    const tuft = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
      hair,
    );
    tuft.position.set(k * 0.062, 0.088, 0.088 - Math.abs(k) * 0.014);
    tuft.rotation.set(0.62, k * 0.28, 0);
    group.add(tuft);
  }
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), hair);
    side.position.set(sx * 0.132, -0.008, -0.01);
    group.add(side);
  }
  return group;
}

/** Backpack, carried on the chest bone. */
function buildBackpack(castShadow: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0, 0.02, -0.17);
  const canvasMat = new THREE.MeshStandardMaterial({ color: "#c9b48a", roughness: 0.8 });
  const trimMat = new THREE.MeshStandardMaterial({ color: "#b5a077", roughness: 0.8 });
  const strapMat = new THREE.MeshStandardMaterial({ color: "#8d7a56", roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.13), canvasMat);
  body.castShadow = castShadow;
  group.add(body);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.1), trimMat);
  lid.position.set(0, 0.12, -0.03);
  group.add(lid);

  for (const sx of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.3, 0.02), strapMat);
    strap.position.set(sx * 0.07, 0.02, 0.065);
    strap.rotation.x = 0.12;
    group.add(strap);
  }
  return group;
}

type Character = {
  group: THREE.Group;
  rig: Rig;
  mesh: THREE.SkinnedMesh;
  dispose: () => void;
};

function buildCharacter(accent: string, castShadow: boolean, face: THREE.CanvasTexture): Character {
  const rig = buildRig();
  const geometry = buildBodyGeometry(rig, accent);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  // The armature is small and always near the camera; skipping the cull test
  // avoids the skinned bounding-box drift that pops limbs mid-stride.
  mesh.frustumCulled = false;
  mesh.add(rig.root);
  mesh.bind(rig.skeleton);

  rig.bones.head.add(buildHeadDressing(face, castShadow));
  rig.bones.chest.add(buildBackpack(castShadow));

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 14),
    new THREE.MeshBasicMaterial({ color: "#0d243f", transparent: true, opacity: 0.25 }),
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.03;

  const group = new THREE.Group();
  group.add(mesh, shadowBlob);

  return {
    group,
    rig,
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      shadowBlob.geometry.dispose();
      (shadowBlob.material as THREE.Material).dispose();
      group.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh && m !== mesh && m !== shadowBlob) {
          m.geometry?.dispose();
          const mat = m.material;
          for (const one of Array.isArray(mat) ? mat : [mat]) one?.dispose();
        }
      });
    },
  };
}

export function Student({
  speed = 0,
  speedRef,
  accent = "#1a3f6d",
  castShadow = true,
  lookRef,
}: StudentProps) {
  const face = useMemo(() => faceTexture(), []);
  const character = useMemo(
    () => buildCharacter(accent, castShadow, face),
    [accent, castShadow, face],
  );
  useEffect(() => character.dispose, [character]);

  /*
   * Only the player instance carries a lookRef, so use it to decide which
   * character publishes the animation test seam — mirroring __controlsTest.
   */
  const isPlayer = Boolean(lookRef);
  useCharacterAnimation(
    character.mesh,
    speedRef,
    speed * 4.6,
    isPlayer
      ? (weights) => {
          window.__characterTest = {
            weights,
            boneRotation: (name) => {
              const bone = character.rig.skeleton.bones.find((b) => b.name === name);
              return bone ? { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z } : null;
            },
          };
        }
      : undefined,
  );

  useEffect(() => {
    if (!isPlayer) return;
    return () => {
      delete window.__characterTest;
    };
  }, [isPlayer]);

  /*
   * Head look, layered on top of the clips: the mixer overwrites the neck and
   * head rotations every frame, so this adds its offset afterwards.
   *
   * Deliberately default priority. A useFrame with priority > 0 takes over
   * R3F's render loop for the whole canvas, and a callback that then draws
   * nothing blanks the entire scene. Ordering is already correct without it:
   * useCharacterAnimation subscribes its mixer first, and R3F runs callbacks
   * of equal priority in subscription order.
   */
  useFrame(() => {
    const look = lookRef?.current;
    if (!look) return;
    const { neck, head } = character.rig.bones;
    neck.rotation.y += look.yaw * 0.45;
    neck.rotation.x += look.pitch * 0.5;
    head.rotation.y += look.yaw * 0.55;
    head.rotation.x += look.pitch * 0.5;
  });

  return <primitive object={character.group} />;
}
