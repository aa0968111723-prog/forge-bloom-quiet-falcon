import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { quality } from "../../quality";
import { DEPARTMENTS } from "../../rpg/data";
import { useRpg } from "../../rpg/store";
import { useArtModel } from "../assets";
import { useReducedArtMotion } from "../motion";
import { CharacterAnimator, type ActionLayer } from "./animator";
import { createSpring, stepSpring, swayTargets } from "./sway.ts";
import { applyHeadLook, captureLookBase, createLookPose, restoreLookBase } from "./look";

export type PlayerActions = {
  swing: number;
  dodge: number;
  /** Bumped by the controller each time a dodge or interaction is accepted. */
  dodgeSerial: number;
  interactSerial: number;
};

type Props = {
  speedRef: { current: number };
  lookRef: { current: { yaw: number; pitch: number } };
  actionRef: { current: PlayerActions };
};

const FALLBACK_KIT = {
  upperBody: ["spine", "chest", "neck", "head", "upperArmL", "lowerArmL", "handL", "upperArmR", "lowerArmR", "handR"],
  actionLayers: { attack: "upper", interact: "upper", hurt: "upper", skill: "full", dodge: "full" } as Record<string, ActionLayer>,
  stride: { walk: 2.96, run: 5.8 },
};

/**
 * The player character, loaded from the exported student kit.
 *
 * Every action is triggered by a real game event — `attackFx` (attack or
 * skill), `hurtUntil`, the controller's accepted dodge and interaction — and
 * the animation never feeds back into combat. Hair tail and turtle charm
 * swing on damped springs from the body's own motion, and rest when the
 * player asks for reduced motion.
 */
/** Hero mesh on the high tier, the LOD1 mesh (same rig and clips) on the low tier. */
export const PROTAGONIST_ART = { high: "char.student-kit", low: "char.student-kit-lod1" } as const;

export function Protagonist({ speedRef, lookRef, actionRef }: Props) {
  const reduced = useReducedArtMotion();
  const [artId] = useState(() => PROTAGONIST_ART[quality().tier]);
  const { root, clips } = useArtModel(artId);
  const kit = useMemo(() => {
    const data = root.getObjectByName("student-kit")?.userData ?? {};
    return {
      upperBody: (data.upperBody as string[]) ?? FALLBACK_KIT.upperBody,
      actionLayers: (data.actionLayers as Record<string, ActionLayer>) ?? FALLBACK_KIT.actionLayers,
      stride: (data.stride as { walk: number; run: number }) ?? FALLBACK_KIT.stride,
    };
  }, [root]);
  const animator = useMemo(
    () => new CharacterAnimator(root, clips, { upperBody: kit.upperBody, layers: kit.actionLayers, stride: kit.stride }),
    [root, clips, kit],
  );
  useEffect(() => () => animator.dispose(), [animator]);

  const bones = useMemo(
    () => ({
      neck: root.getObjectByName("neck")!,
      head: root.getObjectByName("head")!,
      hairTail: root.getObjectByName("hairTail")!,
      charm: root.getObjectByName("charm")!,
    }),
    [root],
  );

  const seen = useRef({
    fxAt: useRpg.getState().attackFx?.at ?? -1,
    hurtUntil: useRpg.getState().hurtUntil,
    dodge: actionRef.current.dodgeSerial,
    interact: actionRef.current.interactSerial,
  });
  const motion = useRef({ hair: createSpring(), charm: createSpring(), last: new THREE.Vector3(), vel: new THREE.Vector3(), primed: false });
  const tmp = useMemo(() => ({ world: new THREE.Vector3(), local: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const lookPose = useRef(createLookPose());
  const lookReady = useRef(false);

  useEffect(
    () => () => {
      delete window.__characterTest;
    },
    [],
  );

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.08);
    const rpg = useRpg.getState();
    const s = seen.current;
    const fx = rpg.attackFx;
    if (fx && fx.at !== s.fxAt) {
      s.fxAt = fx.at;
      const discipline = DEPARTMENTS.find((d) => d.id === rpg.departmentId)?.discipline;
      const named = discipline ? `skill-${discipline}` : "";
      const cast = fx.skill ? (named && animator.has(named) ? named : "skill") : "attack";
      animator.play(cast);
    }
    if (rpg.hurtUntil > s.hurtUntil + 1e-6) {
      s.hurtUntil = rpg.hurtUntil;
      animator.play("hurt");
    }
    const a = actionRef.current;
    if (a.dodgeSerial !== s.dodge) {
      s.dodge = a.dodgeSerial;
      animator.play("dodge");
    }
    if (a.interactSerial !== s.interact) {
      s.interact = a.interactSerial;
      animator.play("interact");
    }

    const speed = speedRef.current;
    if (lookReady.current) restoreLookBase(bones.neck, bones.head, lookPose.current);
    animator.update(dt, speed);
    captureLookBase(bones.neck, bones.head, lookPose.current);
    lookReady.current = true;

    // One glance on the pose the clips just wrote. Resetting to identity would
    // drop a bind pose the gait clips do not overwrite.
    applyHeadLook(bones.neck, bones.head, lookRef.current);

    // Secondary motion from the body's own velocity, in the character frame.
    const m = motion.current;
    root.getWorldPosition(tmp.world);
    if (!m.primed) {
      m.last.copy(tmp.world);
      m.primed = true;
    }
    const v = tmp.local.copy(tmp.world).sub(m.last).divideScalar(Math.max(dt, 1e-3));
    m.last.copy(tmp.world);
    root.getWorldQuaternion(tmp.q);
    v.applyQuaternion(tmp.q.invert());
    const accel = v.clone().sub(m.vel).divideScalar(Math.max(dt, 1e-3));
    m.vel.lerp(v, 0.5);
    const forward = THREE.MathUtils.clamp(m.vel.z, -9, 9);
    const side = THREE.MathUtils.clamp(m.vel.x, -9, 9);
    const sway = swayTargets(forward, side, accel.z, accel.x, reduced);
    stepSpring(m.hair, sway.hairX, sway.hairZ, 70, 9, dt);
    stepSpring(m.charm, sway.charmX, sway.charmZ, 55, 5, dt);
    bones.hairTail.rotation.set(m.hair.x, 0, m.hair.z);
    bones.charm.rotation.set(m.charm.x, 0, m.charm.z);

    window.__characterTest = {
      weights: animator.weights,
      action: animator.current(),
      play: (name: string) => animator.play(name),
      boneRotation: (name: string) => {
        const bone = root.getObjectByName(name);
        return bone ? { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z } : null;
      },
    };
  });

  return (
    <group>
      <primitive object={root} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshBasicMaterial color="#0d243f" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}
