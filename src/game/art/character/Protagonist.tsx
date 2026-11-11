import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { quality } from "../../quality";
import { useRpg } from "../../rpg/store";
import { useArtModel } from "../assets";
import { CharacterAnimator, type ActionLayer } from "./animator";
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

type Spring = { x: number; vx: number; z: number; vz: number };
const spring = (): Spring => ({ x: 0, vx: 0, z: 0, vz: 0 });

function stepSpring(s: Spring, tx: number, tz: number, k: number, damping: number, dt: number) {
  s.vx += (k * (tx - s.x) - damping * s.vx) * dt;
  s.vz += (k * (tz - s.z) - damping * s.vz) * dt;
  s.x += s.vx * dt;
  s.z += s.vz * dt;
}

/**
 * The player character, loaded from the exported student kit.
 *
 * Every action is triggered by a real game event — `attackFx` (attack or
 * skill), `hurtUntil`, the controller's accepted dodge and interaction — and
 * the animation never feeds back into combat. Hair tail and turtle charm
 * swing on damped springs from the body's own motion.
 */
/** Hero mesh on the high tier, the LOD1 mesh (same rig and clips) on the low tier. */
export const PROTAGONIST_ART = { high: "char.student-kit", low: "char.student-kit-lod1" } as const;

export function Protagonist({ speedRef, lookRef, actionRef }: Props) {
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
  const motion = useRef({ hair: spring(), charm: spring(), last: new THREE.Vector3(), vel: new THREE.Vector3(), primed: false });
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
      animator.play(fx.skill ? "skill" : "attack");
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
    stepSpring(
      m.hair,
      THREE.MathUtils.clamp(forward * 0.045 - accel.z * 0.004, -0.25, 0.55),
      THREE.MathUtils.clamp(-side * 0.05 + accel.x * 0.004, -0.4, 0.4),
      70,
      9,
      dt,
    );
    stepSpring(
      m.charm,
      THREE.MathUtils.clamp(forward * 0.07 - accel.z * 0.01, -0.5, 0.9),
      THREE.MathUtils.clamp(-side * 0.08 + accel.x * 0.008, -0.6, 0.6),
      55,
      5,
      dt,
    );
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
