import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Student } from "./Student";
import { input } from "./input";
import { useGame } from "./store";
import { campusAudio } from "./audio";
import { landmarkAt, resolveCollision, SPAWN, terrainHeight } from "./world";

const tmp = new THREE.Vector3();
const PLAYER_R = 0.42;
const WALK = 4.6;
const SPRINT = 7.8;
const CAM_DIST = 5.15;
const CAM_R = 0.7;

export function Player() {
  const group = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z));
  const vel = useRef(new THREE.Vector3());
  const camYaw = useRef(0);
  const camPitch = useRef(0.22);
  const faceYaw = useRef(0);
  const speedRef = useRef(0);
  const hudAcc = useRef(0);
  const { camera, gl } = useThree();

  useEffect(() => {
    input.attach();
    const el = gl.domElement;
    const onClick = () => {
      const s = useGame.getState();
      if (s.phase === "playing" && !s.plaqueId && !window.matchMedia("(pointer: coarse)").matches) {
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
      getPosition: () => ({ x: pos.current.x, y: pos.current.y, z: pos.current.z }),
      setPose: (x: number, z: number, yaw = 0) => {
        pos.current.set(x, terrainHeight(x, z), z);
        vel.current.set(0, 0, 0);
        camYaw.current = yaw;
        faceYaw.current = yaw;
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
      pos.current.set(warp.x, terrainHeight(warp.x, warp.z), warp.z);
      vel.current.set(0, 0, 0);
      camYaw.current = warp.yaw;
      faceYaw.current = warp.yaw;
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
      camera.position.set(-13 + Math.sin(t * 0.1) * 2.2, 31.5, 13 + Math.cos(t * 0.08) * 1.8);
      camera.lookAt(0.5, 20.6, -46);
      return;
    }

    const look = input.consumeLook();
    if (phase === "playing" && !plaqueId) {
      camYaw.current -= look.x * 0.0022;
      camPitch.current = THREE.MathUtils.clamp(camPitch.current - look.y * 0.002, -0.12, 1.12);
    }

    const actions = input.sample();
    if (actions.pause) {
      if (plaqueId) useGame.getState().openPlaque(null);
      else if (phase === "playing") {
        document.exitPointerLock();
        useGame.getState().pause();
      } else if (phase === "paused" || phase === "codex") useGame.getState().resume();
    }

    const frozen = phase !== "playing" || Boolean(plaqueId);

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
    const maxSp = actions.sprint ? SPRINT : WALK;
    if (mag > 0.001) {
      dx /= mag;
      dz /= mag;
      vel.current.x = THREE.MathUtils.damp(vel.current.x, dx * maxSp, 8, delta);
      vel.current.z = THREE.MathUtils.damp(vel.current.z, dz * maxSp, 8, delta);
      faceYaw.current = Math.atan2(-dx, -dz);
    } else {
      vel.current.x = THREE.MathUtils.damp(vel.current.x, 0, 10, delta);
      vel.current.z = THREE.MathUtils.damp(vel.current.z, 0, 10, delta);
    }

    const sp = Math.hypot(vel.current.x, vel.current.z);
    speedRef.current = sp;
    if (sp > 0.4) {
      const nx = pos.current.x + vel.current.x * delta;
      const nz = pos.current.z + vel.current.z * delta;
      const resolved = resolveCollision(nx, nz, PLAYER_R);
      const ground = terrainHeight(resolved.x, resolved.z);
      const step = ground - pos.current.y;
      if (step < 0.7) {
        pos.current.x = resolved.x;
        pos.current.z = resolved.z;
        pos.current.y = ground;
        campusAudio.footstep(performance.now(), actions.sprint);
      } else {
        vel.current.set(0, 0, 0);
      }
    } else {
      pos.current.y = terrainHeight(pos.current.x, pos.current.z);
    }

    const nearby = landmarkAt(pos.current.x, pos.current.z);
    useGame.getState().setNearby(nearby?.id ?? null);
    if (actions.interact && nearby && phase === "playing") {
      if (!useGame.getState().visited.includes(nearby.id)) {
        useGame.getState().stamp(nearby.id);
        campusAudio.stamp();
      } else {
        useGame.getState().openPlaque(nearby.id);
      }
    }

    if (group.current) {
      group.current.position.copy(pos.current);
      group.current.rotation.y = faceYaw.current + Math.PI;
    }

    const lookH = 1.32;
    tmp.set(
      pos.current.x + Math.sin(camYaw.current) * Math.cos(camPitch.current) * CAM_DIST,
      pos.current.y + lookH + 0.42 + Math.sin(camPitch.current) * CAM_DIST,
      pos.current.z + Math.cos(camYaw.current) * Math.cos(camPitch.current) * CAM_DIST,
    );
    const pushed = resolveCollision(tmp.x, tmp.z, CAM_R);
    tmp.x = pushed.x;
    tmp.z = pushed.z;
    const camGround = terrainHeight(tmp.x, tmp.z) + 1.25;
    if (tmp.y < camGround) tmp.y = camGround;
    if (snapped) camera.position.copy(tmp);
    else camera.position.lerp(tmp, 1 - Math.exp(-10 * delta));
    camera.lookAt(pos.current.x, pos.current.y + lookH, pos.current.z);

    hudAcc.current += delta;
    if (hudAcc.current > 0.12 || snapped) {
      hudAcc.current = 0;
      useGame.getState().setPlayer(pos.current.x, pos.current.z, camYaw.current);
    }
  });

  return (
    <group ref={group}>
      <Student speedRef={speedRef} />
    </group>
  );
}
