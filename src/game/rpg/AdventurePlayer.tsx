import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Student } from "../Student";
import { ArtBoundary } from "../art/ArtBoundary";
import { Protagonist, type PlayerActions } from "../art/character/Protagonist";
import { input } from "./input";
import { gearBonus } from "../../features/items-equipment-building/gear";
import { SPRINT, WALK, moveTargetSpeed } from "./move";
import { inventory, useRpg } from "./store";
import { resolveBuildings, resolveInterior } from "./rules";
import { CAMPUS_SITES } from "./campus";
import { useGame } from "../store";
import { campusAudio } from "../audio";
import { landmarkAt, resolveCollision, SPAWN, terrainHeight } from "../world";
import { pavedAt } from "../world-data/paths.ts";
import { kenanSection } from "../world-data/kenan.ts";
import { followCameraSeed, TITLE_ORBIT } from "./follow";

const tmp = new THREE.Vector3();
const PLAYER_R = 0.42;

/** QA photo camera (art review captures only); null during normal play. */
let photo: { distance: number; height: number; yaw: number; lookY: number; target?: { x: number; y: number; z: number } } | null = null;
const CAM_R = 0.7;
const BASE_FOV = 58;
const SPRINT_FOV = 63;

/** Shortest-path angular lerp, so the body never spins the long way round. */
function dampAngle(
  current: number,
  target: number,
  lambda: number,
  delta: number,
) {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * delta));
}

export function AdventurePlayer() {
  const group = useRef<THREE.Group>(null);
  const initial = useRef({ x: useGame.getState().playerX, z: useGame.getState().playerZ, yaw: useGame.getState().playerYaw });
  const pos = useRef(new THREE.Vector3(initial.current.x, useRpg.getState().interiorId ? 0 : terrainHeight(initial.current.x, initial.current.z), initial.current.z));
  const vel = useRef(new THREE.Vector3());
  const camYaw = useRef(initial.current.yaw);
  const camPitch = useRef(0.22);
  const faceYaw = useRef(initial.current.yaw);
  const faceYawTarget = useRef(initial.current.yaw);
  /** Rendered height: follows the logical height smoothly so climbing the 132
   *  steps reads as a climb, not a 6 Hz stutter. */
  const visualY = useRef(pos.current.y);
  const speedRef = useRef(0);
  /** Gait speed for animation: the intended pace while input pushes into a wall. */
  const strideRef = useRef(0);
  const lookRef = useRef({ yaw: 0, pitch: 0 });
  const hudAcc = useRef(0);
  const dodgeTime = useRef(0);
  const dodgeDirection = useRef({ x: 0, z: -1 });
  const actionRef = useRef<PlayerActions>({ swing: 0, dodge: 0, dodgeSerial: 0, interactSerial: 0 });
  const groundAt = (x: number, z: number) =>
    useRpg.getState().interiorId ? 0 : terrainHeight(x, z);
  const collide = (x: number, z: number, radius: number) =>
    useRpg.getState().interiorId
      ? resolveInterior(
          x,
          z,
          radius,
          CAMPUS_SITES.find((s) => s.id === useRpg.getState().interiorId)
            ?.theme !== "sport",
        )
      : resolveBuildings(x, z, radius, useRpg.getState().buildings);
  const { camera, gl } = useThree();

  useLayoutEffect(() => {
    const live = useGame.getState();
    if (live.phase === "title" || live.phase === "setup") return;
    const y = useRpg.getState().interiorId
      ? 0
      : terrainHeight(live.playerX, live.playerZ);
    const seed = followCameraSeed({
      x: live.playerX,
      y,
      z: live.playerZ,
      yaw: live.playerYaw,
    });
    camera.position.set(seed.x, seed.y, seed.z);
    camera.lookAt(live.playerX, y + 1.32, live.playerZ);
  }, [camera]);

  useEffect(() => {
    input.attach();
    const el = gl.domElement;
    const onClick = () => {
      const s = useGame.getState();
      if (
        s.phase === "playing" &&
        !s.plaqueId &&
        !window.matchMedia("(pointer: coarse)").matches
      ) {
        el.requestPointerLock();
      }
    };
    el.addEventListener("click", onClick);
    window.__controlsTest = {
      getYaw: () => camYaw.current,
      getSpeed: () => speedRef.current,
      setBenchmark: (id) => useGame.getState().setBenchmark(id),
      getBenchmark: () => useGame.getState().benchmarkId,
      setYaw: (yaw: number) => {
        // Steer without killing momentum — the traversal harness turns while
        // walking, the way a player does.
        camYaw.current = yaw;
      },
      setKeys: (codes) => {
        input.inject = codes;
      },
      setPhoto: (p) => {
        photo = p;
      },
      getPosition: () => ({
        x: pos.current.x,
        y: pos.current.y,
        z: pos.current.z,
      }),
      getCamera: () => ({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      }),
      setPose: (x: number, z: number, yaw = 0) => {
        pos.current.set(x, terrainHeight(x, z), z);
        vel.current.set(0, 0, 0);
        camYaw.current = yaw;
        faceYaw.current = yaw;
        faceYawTarget.current = yaw;
        camPitch.current = 0.22;
        useGame.getState().setPlayer(x, z, yaw);
        useGame.setState({ snapCam: true });
      },
    };
    return () => {
      el.removeEventListener("click", onClick);
      input.detach();
      delete window.__controlsTest;
    };
  }, [gl]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.08);
    const phase = useGame.getState().phase;
    const plaqueId = useGame.getState().plaqueId;
    const warp = useGame.getState().warp;
    let snapped = false;
    if (warp) {
      pos.current.set(warp.x, groundAt(warp.x, warp.z), warp.z);
      vel.current.set(0, 0, 0);
      camYaw.current = warp.yaw;
      faceYaw.current = warp.yaw;
      faceYawTarget.current = warp.yaw;
      camPitch.current = 0.22;
      useGame.getState().clearWarp();
      snapped = true;
    }
    if (useGame.getState().snapCam) {
      snapped = true;
      useGame.getState().clearSnap();
    }

    // Reality Compare Mode (F8) owns the camera outright.
    if (useGame.getState().benchmarkId) return;

    if (phase === "title") {
      // Drift above 驚聲銅像廣場 looking north down 宮燈大道.
      const t = state.clock.elapsedTime;
      camera.position.set(
        TITLE_ORBIT.x + Math.sin(t * 0.1) * 2.2,
        TITLE_ORBIT.y,
        TITLE_ORBIT.z + Math.cos(t * 0.08) * 1.8,
      );
      camera.lookAt(0.5, 20.6, -46);
      return;
    }

    const actions = input.sample();
    if (phase === "playing" && !plaqueId) {
      camYaw.current -= actions.lookX * 0.0022;
      camPitch.current = THREE.MathUtils.clamp(
        camPitch.current - actions.lookY * 0.002,
        -0.12,
        1.12,
      );
    }

    const rpg = useRpg.getState();
    const swingAge = rpg.attackFx ? rpg.clock - rpg.attackFx.at : 1;
    actionRef.current.swing =
      swingAge >= 0 && swingAge < 0.36
        ? Math.sin((swingAge / 0.36) * Math.PI)
        : 0;
    actionRef.current.dodge = Math.max(0, dodgeTime.current / 0.28);
    for (let n = 0; n < actions.pauseCount; n++) {
      const liveRpg = useRpg.getState();
      const liveGame = useGame.getState();
      if (liveRpg.panel) liveRpg.setPanel(null);
      else if (liveRpg.buildKind) liveRpg.cancelBuild();
      else if (liveGame.plaqueId) liveGame.openPlaque(null);
      else if (liveGame.phase === "playing") {
        document.exitPointerLock();
        liveGame.pause();
      } else if (liveGame.phase === "paused" || liveGame.phase === "codex")
        liveGame.resume();
    }

    const frozen =
      phase !== "playing" ||
      Boolean(plaqueId) ||
      Boolean(rpg.panel) ||
      rpg.hp <= 0;

    const fx = -Math.sin(camYaw.current);
    const fz = -Math.cos(camYaw.current);
    const rx = Math.cos(camYaw.current);
    const rz = -Math.sin(camYaw.current);

    let dx = 0;
    let dz = 0;
    if (!frozen) {
      dx = fx * actions.moveY + rx * actions.moveX;
      dz = fz * actions.moveY + rz * actions.moveX;
    }
    const mag = Math.hypot(dx, dz);
    if (mag > 0.001) {
      const pace = gearBonus(rpg.loadout, rpg.gear, (id) => inventory.count(id) > 0).moveScale;
      const speed = moveTargetSpeed(actions.moveX, actions.moveY, actions.sprint) * pace;
      const scale = speed / mag;
      const tx = dx * scale;
      const tz = dz * scale;
      vel.current.x = THREE.MathUtils.damp(vel.current.x, tx, 8, delta);
      vel.current.z = THREE.MathUtils.damp(vel.current.z, tz, 8, delta);
      faceYawTarget.current = Math.atan2(-tx, -tz);
    } else {
      vel.current.x = THREE.MathUtils.damp(vel.current.x, 0, 10, delta);
      vel.current.z = THREE.MathUtils.damp(vel.current.z, 0, 10, delta);
    }

    // The body turns toward its heading rather than snapping to it.
    faceYaw.current = dampAngle(
      faceYaw.current,
      faceYawTarget.current,
      12,
      delta,
    );

    let dodged = false;
    if (!frozen) {
      for (let n = 0; n < actions.dodgeCount; n++) {
        if (useRpg.getState().dodge()) dodged = true;
      }
    }
    if (dodged) {
      dodgeTime.current = 0.28;
      actionRef.current.dodgeSerial += 1;
      dodgeDirection.current =
        mag > 0.01
          ? { x: dx / Math.hypot(dx, dz), z: dz / Math.hypot(dx, dz) }
          : { x: fx, z: fz };
    }
    if (!frozen && dodgeTime.current > 0) {
      dodgeTime.current -= delta;
      vel.current.x = dodgeDirection.current.x * 13;
      vel.current.z = dodgeDirection.current.z * 13;
    }
    if (frozen) vel.current.set(0, 0, 0);
    const sp = Math.hypot(vel.current.x, vel.current.z);
    speedRef.current = sp;
    // Pushing against a wall or a too-high step zeroes velocity; keep a slow
    // stride in place instead of an idle stand while the stick is held.
    const pace = gearBonus(rpg.loadout, rpg.gear, (id) => inventory.count(id) > 0).moveScale;
    const intended = !frozen && mag > 0.001 ? moveTargetSpeed(actions.moveX, actions.moveY, actions.sprint) * pace : 0;
    strideRef.current = Math.max(sp, intended * 0.45);
    if (sp > 0.4) {
      const nx = pos.current.x + vel.current.x * delta;
      const nz = pos.current.z + vel.current.z * delta;
      const resolved = collide(nx, nz, PLAYER_R);
      const ground = groundAt(resolved.x, resolved.z);
      const step = ground - pos.current.y;
      if (step < 0.7) {
        pos.current.x = resolved.x;
        pos.current.z = resolved.z;
        pos.current.y = ground;
        // Stone on the slope and any paving; grass everywhere else.
        const onStone =
          kenanSection(resolved.z) !== null ||
          pavedAt(resolved.x, resolved.z, 0.4);
        campusAudio.footstep(
          performance.now(),
          actions.sprint,
          onStone ? "stone" : "grass",
        );
      } else {
        vel.current.set(0, 0, 0);
      }
    } else {
      pos.current.y = groundAt(pos.current.x, pos.current.z);
    }

    const nearby = rpg.interiorId
      ? null
      : landmarkAt(pos.current.x, pos.current.z);
    useGame.getState().setNearby(nearby?.id ?? null);

    // Glance at whatever landmark is close, but only when it is off to the
    // side — staring straight ahead is what the body already does.
    {
      let targetYaw = 0;
      let targetPitch = 0;
      if (nearby) {
        const toYaw = Math.atan2(
          -(nearby.x - pos.current.x),
          -(nearby.z - pos.current.z),
        );
        let rel = (toYaw - faceYaw.current) % (Math.PI * 2);
        if (rel > Math.PI) rel -= Math.PI * 2;
        if (rel < -Math.PI) rel += Math.PI * 2;
        // Necks do not swivel: clamp hard and ignore anything behind.
        if (Math.abs(rel) < 1.5) {
          targetYaw = THREE.MathUtils.clamp(rel, -0.7, 0.7);
          targetPitch = -0.08;
        }
      }
      lookRef.current.yaw = THREE.MathUtils.damp(
        lookRef.current.yaw,
        targetYaw,
        4,
        delta,
      );
      lookRef.current.pitch = THREE.MathUtils.damp(
        lookRef.current.pitch,
        targetPitch,
        4,
        delta,
      );
    }
    if (!frozen) {
      for (let n = 0; n < actions.interactCount; n++) {
        const committed = useRpg.getState().commitPrompt();
        if (committed) actionRef.current.interactSerial += 1;
        if (committed === "stamp") campusAudio.stamp();
      }
    }

    // Smooth the rendered height over the stepped ground. Snapped on warps.
    if (snapped) visualY.current = pos.current.y;
    else
      visualY.current = THREE.MathUtils.damp(
        visualY.current,
        pos.current.y,
        16,
        delta,
      );

    if (group.current) {
      group.current.position.set(pos.current.x, visualY.current, pos.current.z);
      group.current.rotation.y = faceYaw.current + Math.PI;
    }

    hudAcc.current += delta;
    if (hudAcc.current > 0.12 || snapped) {
      hudAcc.current = 0;
      useGame
        .getState()
        .setPlayer(pos.current.x, pos.current.z, camYaw.current);
    }

    if (photo) {
      const c = photo.target ?? { x: pos.current.x, y: visualY.current, z: pos.current.z };
      camera.position.set(c.x + Math.sin(photo.yaw) * photo.distance, c.y + photo.height, c.z + Math.cos(photo.yaw) * photo.distance);
      camera.lookAt(c.x, c.y + photo.lookY, c.z);
      return;
    }

    const lookH = 1.32;
    const seeded = followCameraSeed({
      x: pos.current.x,
      y: visualY.current,
      z: pos.current.z,
      yaw: camYaw.current,
      pitch: camPitch.current,
    });
    tmp.set(seeded.x, seeded.y, seeded.z);
    const pushed = collide(tmp.x, tmp.z, CAM_R);
    tmp.x = pushed.x;
    tmp.z = pushed.z;
    const camGround = groundAt(tmp.x, tmp.z) + 1.25;
    if (tmp.y < camGround) tmp.y = camGround;
    if (snapped) camera.position.copy(tmp);
    else camera.position.lerp(tmp, 1 - Math.exp(-10 * delta));

    // Look-ahead: the camera looks slightly into the direction of travel, so
    // running opens up the view the way a good third-person rig does.
    const lookAhead = Math.min(sp / SPRINT, 1) * 1.15;
    camera.lookAt(
      pos.current.x +
        (sp > 0.2 ? (vel.current.x / Math.max(sp, 0.01)) * lookAhead : 0),
      visualY.current + lookH,
      pos.current.z +
        (sp > 0.2 ? (vel.current.z / Math.max(sp, 0.01)) * lookAhead : 0),
    );

    // Sprint widens the FOV a touch; easing sells the speed change.
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera) {
      const targetFov =
        BASE_FOV +
        (SPRINT_FOV - BASE_FOV) * Math.max(0, (sp - WALK) / (SPRINT - WALK));
      const next = THREE.MathUtils.damp(persp.fov, targetFov, 4, delta);
      if (Math.abs(next - persp.fov) > 0.01) {
        persp.fov = next;
        persp.updateProjectionMatrix();
      }
    }
  });

  // The previous procedural student stands in while the kit streams and if it
  // ever fails to load, so the player is never invisible.
  const standIn = <Student speedRef={speedRef} lookRef={lookRef} actionRef={actionRef} />;
  return (
    <group ref={group}>
      <ArtBoundary id="char.student-kit" fallback={standIn} onFail={(m) => useRpg.getState().notify(m)}>
        <Suspense fallback={standIn}>
          <Protagonist speedRef={strideRef} lookRef={lookRef} actionRef={actionRef} />
        </Suspense>
      </ArtBoundary>
    </group>
  );
}
