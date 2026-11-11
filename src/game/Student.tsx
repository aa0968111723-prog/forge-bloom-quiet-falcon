import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useCharacterAnimation } from "./character/useCharacterAnimation";
import { STUDENT_JADE } from "./character/dressing";
import { buildCharacter } from "./character/model";

type StudentProps = {
  actionRef?: { current: { swing: number; dodge: number } };
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
export function Student({
  speed = 0,
  speedRef,
  accent = STUDENT_JADE,
  castShadow = true,
  lookRef,
  actionRef,
}: StudentProps) {
  const character = useMemo(
    () => buildCharacter(accent, castShadow, Boolean(lookRef)),
    [accent, castShadow, lookRef],
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
              const bone = character.rig.skeleton.bones.find(
                (b) => b.name === name,
              );
              return bone
                ? { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z }
                : null;
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
    if (actionRef) {
      const { swing, dodge } = actionRef.current;
      character.rig.bones.upperArmR.rotation.x -= swing * 1.65;
      character.rig.bones.upperArmR.rotation.z -= swing * 0.6;
      character.rig.bones.lowerArmR.rotation.x -= swing * 0.7;
      character.rig.bones.chest.rotation.y += swing * 0.35;
      character.rig.bones.spine.rotation.x += dodge * 0.45;
    }
  });

  return <primitive object={character.group} />;
}
