import * as THREE from "three";
import { buildBodyGeometry, buildRig, type Rig } from "./rig.ts";
import { studentHead, studentOutfit, studentBackpack } from "./dressing.ts";
type Character = {
  group: THREE.Group;
  rig: Rig;
  mesh: THREE.SkinnedMesh;
  dispose: () => void;
};

export function buildCharacter(
  accent: string,
  castShadow: boolean,
  hero: boolean,
): Character {
  const rig = buildRig();
  const geometry = buildBodyGeometry(rig, accent);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
  });

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  // The armature is small and always near the camera; skipping the cull test
  // avoids the skinned bounding-box drift that pops limbs mid-stride.
  mesh.frustumCulled = false;
  mesh.add(rig.root);
  mesh.bind(rig.skeleton);

  rig.bones.head.add(studentHead(hero));
  rig.bones.chest.add(studentBackpack(), studentOutfit(accent));
  mesh.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = castShadow; });

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 14),
    new THREE.MeshBasicMaterial({
      color: "#0d243f",
      transparent: true,
      opacity: 0.25,
    }),
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
      rig.skeleton.dispose();
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

