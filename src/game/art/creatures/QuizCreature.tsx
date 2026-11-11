import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedArtMotion } from "../../art/motion";
import { quality } from "../../quality";
import { useGame } from "../../store";
import { terrainHeight } from "../../world";
import { ENEMY_TYPES } from "../../rpg/data";
import { useRpg } from "../../rpg/store";
import { useArtModel } from "../assets";
import { paperBurst, penCircleGeometry } from "../vfx/combat-vfx";
import { nextWindupProgress } from "./windup";

type Enemy = ReturnType<typeof useRpg.getState>["enemies"][number];

const TYPE = ENEMY_TYPES.quiz;
/** The strike lands on anything within this radius when the windup ends (store.ts tickRpg). */
const REACH = TYPE.radius + 2.5;
const ATTACK_TIME = 0.42;
const HURT_TIME = 0.32;
const DEFEAT_TIME = 1.2;
const AMBER = new THREE.Color("#f0a648");
const RED = new THREE.Color("#d8343f");
const FLASH = new THREE.Color("#fff3d6");

/**
 * 突擊小考 on the field.
 *
 * Reads only the live enemy record (state, timer, hurt, hp) that `tickRpg`
 * owns. Idle/chase loops follow `state`; the windup clip is scrubbed by real
 * windup progress; the strike plays on the windup → recover transition, the
 * flinch on each new `hurt`, the crumple on death. The telegraph is drawn at
 * the exact reach the strike tests, so what the player sees is what hits.
 */
export function QuizCreature({ enemy }: { enemy: Enemy }) {
  const { root, clips } = useArtModel("creature.quiz");
  const reduced = useReducedArtMotion();
  const low = quality().tier === "low";

  const anim = useMemo(() => {
    const mixer = new THREE.AnimationMixer(root);
    const make = (name: string) => {
      const clip = clips.find((c) => c.name === name);
      if (!clip) throw new Error(`creature.quiz is missing clip ${name}`);
      const action = mixer.clipAction(clip);
      action.play();
      action.timeScale = 0;
      action.setEffectiveWeight(0);
      return action;
    };
    const actions = {
      idle: make("idle"),
      chase: make("chase"),
      windup: make("windup"),
      attack: make("attack"),
      hurt: make("hurt"),
      defeat: make("defeat"),
    };
    actions.idle.setEffectiveWeight(1);
    return { mixer, actions };
  }, [root, clips]);
  useEffect(
    () => () => {
      anim.mixer.stopAllAction();
      anim.mixer.uncacheRoot(root);
    },
    [anim, root],
  );

  const material = useMemo(() => {
    let found: THREE.MeshStandardMaterial | null = null;
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && !found) found = m;
    });
    return found as THREE.MeshStandardMaterial | null;
  }, [root]);
  const orbit = useMemo(() => root.getObjectByName("orbit"), [root]);

  const fx = useMemo(() => {
    const ring = new THREE.Mesh(
      penCircleGeometry(REACH, 0.13, enemy.anchorX),
      new THREE.MeshBasicMaterial({ color: RED, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    );
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, depthWrite: false, toneMapped: false }),
    );
    fill.rotation.x = -Math.PI / 2;
    const shock = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 56),
      new THREE.MeshBasicMaterial({ color: RED, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    );
    shock.rotation.x = -Math.PI / 2;
    // "!" mark above the sheet, built from geometry so it needs no font.
    const mark = new THREE.Group();
    const markMat = new THREE.MeshBasicMaterial({ color: RED, toneMapped: false, transparent: true });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.05), markMat);
    bar.position.y = 0.32;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), markMat);
    mark.add(bar, dot);
    for (const m of [ring, fill, shock, mark]) {
      m.renderOrder = 3;
      m.visible = false;
    }
    // Ground decals must beat the raised paving (+0.06 m, negative polygon offset) and kerbs.
    for (const m of [ring, fill, shock]) {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -8;
      mat.polygonOffsetUnits = -8;
    }
    const chips = paperBurst(low ? 6 : 12, ["#f5ecd6", "#f5ecd6", "#c8414b", "#e6dcc3"], 0.1, 0.65);
    const confetti = paperBurst(low ? 8 : 20, ["#f5ecd6", "#e6dcc3", "#f2c14e", "#c8414b"], 0.16, 1.4);
    return { ring, fill, shock, mark, markMat, chips, confetti };
  }, [enemy.anchorX, low]);
  useEffect(
    () => () => {
      for (const m of [fx.ring, fx.fill, fx.shock]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      fx.mark.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      fx.markMat.dispose();
      fx.chips.dispose();
      fx.confetti.dispose();
    },
    [fx],
  );

  const group = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);
  const label = useRef<THREE.Group>(null);
  const live = useRef({
    state: enemy.state,
    hp: enemy.hp,
    hurt: enemy.hurt,
    attackAge: Infinity,
    hurtAge: Infinity,
    deathAge: enemy.hp > 0 ? Infinity : DEFEAT_TIME + 1,
    yaw: 0,
    weights: { idle: 1, chase: 0, windup: 0 },
    clock: 0,
    windup: 0,
  });
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, raw) => {
    const dt = Math.min(raw, 0.08);
    const g = group.current;
    if (!g) return;
    const rpg = useRpg.getState();
    const s = live.current;
    s.clock += dt;

    // Events from real state transitions.
    if (s.state === "windup" && enemy.state === "recover") s.attackAge = 0;
    if (enemy.hurt > s.hurt + 0.05) {
      s.hurtAge = 0;
      if (!reduced) fx.chips.fire(tmp.set(enemy.x, terrainHeight(enemy.x, enemy.z) + 1.0, enemy.z), low ? 6 : 12);
    }
    if (s.hp > 0 && enemy.hp <= 0) {
      s.deathAge = 0;
      if (!reduced) fx.confetti.fire(tmp.set(enemy.x, terrainHeight(enemy.x, enemy.z) + 0.9, enemy.z), low ? 8 : 20, { up: 3.2, spread: 1.6, spin: 6 });
    }
    if (s.hp <= 0 && enemy.hp > 0) s.deathAge = Infinity;
    if (enemy.state === "windup" && s.state !== "windup") s.windup = 1 - enemy.timer / TYPE.windup;
    s.state = enemy.state;
    s.hp = enemy.hp;
    s.hurt = enemy.hurt;
    s.attackAge += dt;
    s.hurtAge += dt;
    s.deathAge += dt;
    fx.chips.update(dt);
    fx.confetti.update(dt);

    const dying = s.deathAge < DEFEAT_TIME + 0.1;
    const far = Math.hypot(camera.position.x - enemy.x, camera.position.z - enemy.z) > (low ? 65 : 90);
    g.visible = !rpg.interiorId && !far && (enemy.hp > 0 || dying);
    if (!g.visible) return;

    const ground = terrainHeight(enemy.x, enemy.z);
    g.position.set(enemy.x, ground, enemy.z);
    const player = useGame.getState();
    const simHeld =
      player.phase !== "playing" ||
      Boolean(rpg.panel) ||
      Boolean(player.plaqueId) ||
      !rpg.departmentId ||
      rpg.hp <= 0 ||
      Boolean(player.benchmarkId) ||
      Boolean(rpg.interiorId);
    const targetYaw = Math.atan2(player.playerX - enemy.x, player.playerZ - enemy.z);
    let d = targetYaw - s.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (!dying) s.yaw += d * Math.min(1, dt * 8);
    root.rotation.y = s.yaw;

    // Windup progress follows the store timer. Between ≥50 ms ticks, ease
    // forward. A panel or plaque freezes tickRpg, so the graphic holds too.
    if (enemy.state === "windup") {
      s.windup = nextWindupProgress(s.windup, enemy.timer, TYPE.windup, dt, simHeld);
    } else {
      s.windup = 0;
    }
    const progress = enemy.state === "windup" ? s.windup : 0;

    // Clip weights.
    const a = anim.actions;
    const base = { idle: 0, chase: 0, windup: 0 };
    if (enemy.state === "chase") base.chase = 1;
    else if (enemy.state === "windup") base.windup = 1;
    else base.idle = 1;
    const k = 1 - Math.exp(-14 * dt);
    for (const key of ["idle", "chase", "windup"] as const) s.weights[key] += (base[key] - s.weights[key]) * k;
    const attackW = s.attackAge < ATTACK_TIME ? 1 : 0;
    const hurtW = s.hurtAge < HURT_TIME && !attackW ? 1 : 0;
    const deathW = dying ? 1 : 0;
    const override = Math.max(attackW, hurtW, deathW);
    a.idle.setEffectiveWeight(s.weights.idle * (1 - override));
    a.chase.setEffectiveWeight(s.weights.chase * (1 - override));
    a.windup.setEffectiveWeight(s.weights.windup * (1 - override));
    a.attack.setEffectiveWeight(attackW * (1 - deathW));
    a.hurt.setEffectiveWeight(hurtW * (1 - deathW));
    a.defeat.setEffectiveWeight(deathW);
    const loopTime = reduced ? 0 : s.clock;
    a.idle.time = loopTime % a.idle.getClip().duration;
    a.chase.time = (loopTime * 1.4) % a.chase.getClip().duration;
    a.windup.time = progress * a.windup.getClip().duration * 0.999;
    a.attack.time = Math.min(s.attackAge, ATTACK_TIME - 1e-3);
    a.hurt.time = Math.min(s.hurtAge, HURT_TIME - 1e-3);
    a.defeat.time = Math.min(s.deathAge, DEFEAT_TIME - 1e-3);
    anim.mixer.update(0);
    if (orbit) {
      orbit.visible = !low;
      if (!reduced) orbit.rotation.y = s.clock * (enemy.state === "windup" ? 4.5 : 1.3);
    }

    // Hit flash and the red glow that builds during the windup.
    if (material) {
      const flash = s.hurtAge < 0.2 ? 1 - s.hurtAge / 0.2 : 0;
      material.emissive.copy(flash > 0 ? FLASH : RED);
      material.emissiveIntensity = Math.max(flash * 0.9, progress * progress * 0.35);
    }

    // Telegraph: true reach, filled by real progress.
    const warn = enemy.state === "windup" && enemy.hp > 0;
    fx.ring.visible = warn;
    fx.fill.visible = warn;
    fx.mark.visible = warn;
    if (warn) {
      const lift = ground + 0.16;
      fx.ring.position.set(enemy.x, lift + 0.01, enemy.z);
      fx.fill.position.set(enemy.x, lift, enemy.z);
      fx.fill.scale.setScalar(Math.max(0.05, REACH * progress));
      const late = THREE.MathUtils.smoothstep(progress, 0.55, 1);
      const pulse = reduced ? 0 : Math.sin(s.clock * 18) * 0.08 * late;
      (fx.fill.material as THREE.MeshBasicMaterial).color.copy(AMBER).lerp(RED, late);
      (fx.fill.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.22 * progress + pulse;
      (fx.ring.material as THREE.MeshBasicMaterial).opacity = 0.75 + 0.25 * late;
      fx.mark.position.set(enemy.x, ground + 2.0 + (reduced ? 0 : Math.sin(s.clock * 9) * 0.05), enemy.z);
      fx.mark.quaternion.copy(camera.quaternion);
      fx.markMat.opacity = 0.6 + 0.4 * late;
    }
    // Strike shockwave out to the reach.
    const strike = s.attackAge < 0.3;
    fx.shock.visible = strike;
    if (strike) {
      const t = s.attackAge / 0.3;
      fx.shock.position.set(enemy.x, ground + 0.18, enemy.z);
      fx.shock.scale.setScalar(REACH * (reduced ? 1 : 0.55 + 0.45 * t));
      (fx.shock.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
    }

    if (bar.current) {
      const f = Math.max(0.001, enemy.hp / TYPE.hp);
      bar.current.scale.x = f;
      bar.current.position.x = -(1 - f) * 0.7;
    }
    if (label.current) {
      label.current.visible = enemy.hp > 0;
      label.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <>
      <group ref={group}>
        <primitive object={root} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <circleGeometry args={[0.5, 20]} />
          <meshBasicMaterial color="#182a35" transparent opacity={0.2} depthWrite={false} />
        </mesh>
        <group ref={label} position={[0, 2.45, 0]}>
          <mesh>
            <planeGeometry args={[1.5, 0.08]} />
            <meshBasicMaterial color="#283f43" />
          </mesh>
          <mesh ref={bar} position={[0, 0, 0.01]}>
            <planeGeometry args={[1.4, 0.05]} />
            <meshBasicMaterial color={TYPE.color} />
          </mesh>
        </group>
      </group>
      <primitive object={fx.ring} />
      <primitive object={fx.fill} />
      <primitive object={fx.shock} />
      <primitive object={fx.mark} />
      <primitive object={fx.chips.mesh} />
      <primitive object={fx.confetti.mesh} />
    </>
  );
}
