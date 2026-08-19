import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { AXIS, PLAZA_ELEVATION } from "../world-data/axis.ts";
import { sampleGroundElevation, spineRampElevation } from "../world-data/elevation.ts";
import {
  KENAN,
  KENAN_LANDING_ELEVATION,
  KENAN_LANDING_Z,
  KENAN_STEPS,
  KENAN_TOP_Z,
  KENAN_TOTAL_RISE,
  kenanDrainPositions,
} from "../world-data/kenan.ts";
import { worldUvBox } from "../world/geometry";

/**
 * 克難坡 — Reality Benchmark #1.
 *
 * Every tread is a real tread. The 132 steps come from `KENAN_STEPS`, which is
 * derived from the riser and tread in `world-data/kenan.ts`, so the geometry, the
 * surface the player walks on and the dimensions the F8 panel reports can never
 * disagree with each other.
 *
 * Construction, bottom to top:
 *   坡底鋪面 → 66 階 → 中間平台 → 66 階 → 坡頂鋪面 → 驚聲銅像廣場
 *
 * Each tread is drawn as a box whose top face is exactly at `treadTop` and which
 * extends down past the tread below, so the riser is a real face and the terrain
 * ramp underneath is never visible. Side walls are continuous prisms following
 * the same profile, with an open drainage channel and grates inside them — the
 * details that make a stair read as built rather than extruded.
 */
const dummy = new THREE.Object3D();

/** How far below its own top each tread box extends. Covers the riser + ramp. */
const TREAD_DROP = 0.62;

export function KenanSlope({ wetness }: { wetness: number }) {
  const mats = useTamkangMaterials();
  const treads = useRef<THREE.InstancedMesh>(null);
  const grates = useRef<THREE.InstancedMesh>(null);

  const treadGeo = useMemo(
    // 0.2 m wider than the clear width so the tread ends embed in the walls
    // instead of meeting them edge-on and flickering.
    () => worldUvBox(KENAN.width + 0.2, TREAD_DROP, KENAN.tread, mats["kenan/stone-step"].spec.tile),
    [mats],
  );
  const grateGeo = useMemo(
    () => worldUvBox(KENAN.gutterWidth + 0.04, 0.06, 0.55, 0.6),
    [],
  );

  useLayoutEffect(() => {
    const mesh = treads.current;
    if (!mesh) return;
    KENAN_STEPS.forEach((step, i) => {
      dummy.position.set(0, step.treadTop - TREAD_DROP / 2, (step.nosingZ + step.backZ) / 2);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [treadGeo]);

  const drainZs = useMemo(() => kenanDrainPositions(), []);
  useLayoutEffect(() => {
    const mesh = grates.current;
    if (!mesh) return;
    let i = 0;
    for (const z of drainZs) {
      for (const s of [-1, 1] as const) {
        const y = sampleGroundElevation(0, z);
        dummy.position.set(s * (KENAN.width / 2 - KENAN.gutterInset), y + 0.02, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [drainZs, grateGeo]);

  /** Continuous wall + gutter prisms that follow the stepped profile. */
  const wallGeos = useMemo(() => {
    const tile = mats["kenan/retaining-wall"].spec.tile;
    const build = (
      innerX: number,
      thickness: number,
      heightAbove: number,
      dropBelow: number,
      zFrom: number,
      zTo: number,
    ) => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const index: number[] = [];
      const steps = Math.max(2, Math.ceil(Math.abs(zFrom - zTo) / 0.64));
      let run = 0;
      for (let k = 0; k <= steps; k++) {
        const z = zFrom + ((zTo - zFrom) * k) / steps;
        // Follow the smooth ramp: a real wall coping runs as a clean grade
        // rather than stepping per tread. Raised so the coping stays proud of
        // the planted bank that climbs behind it.
        const ground = spineRampElevation(z) + 0.42;
        if (k > 0) run += Math.abs(zTo - zFrom) / steps;
        // 4 verts per station: inner-top, outer-top, inner-bottom, outer-bottom
        const xs = [innerX, innerX + thickness];
        for (const [vi, x] of xs.entries()) {
          positions.push(x, ground + heightAbove, z);
          uvs.push(run / tile, (heightAbove + dropBelow) / tile);
          void vi;
        }
        for (const x of xs) {
          positions.push(x, ground - dropBelow, z);
          uvs.push(run / tile, 0);
        }
        if (k > 0) {
          const p = (k - 1) * 4;
          const c = k * 4;
          // top face
          index.push(p, c, p + 1, p + 1, c, c + 1);
          // inner face
          index.push(p, p + 2, c, c, p + 2, c + 2);
          // outer face
          index.push(p + 1, c + 1, p + 3, p + 3, c + 1, c + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(index);
      geo.computeVertexNormals();
      return geo;
    };
    const zFrom = KENAN.bottomZ + 0.6;
    const zTo = KENAN_TOP_Z - 0.4;
    return [
      build(-KENAN.width / 2 - KENAN.wallThickness, KENAN.wallThickness, KENAN.wallHeight, 2.4, zFrom, zTo),
      build(KENAN.width / 2, KENAN.wallThickness, KENAN.wallHeight, 2.4, zFrom, zTo),
    ];
  }, [mats]);

  /** Open drainage channel inside each wall. */
  const gutterGeos = useMemo(() => {
    const tile = mats["kenan/wet-concrete"].spec.tile;
    const build = (centreX: number) => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const index: number[] = [];
      const zFrom = KENAN.bottomZ + 0.4;
      const zTo = KENAN_TOP_Z - 0.2;
      const steps = Math.ceil(Math.abs(zFrom - zTo) / 0.32);
      const half = KENAN.gutterWidth / 2;
      let run = 0;
      for (let k = 0; k <= steps; k++) {
        const z = zFrom + ((zTo - zFrom) * k) / steps;
        const ground = sampleGroundElevation(0, z);
        if (k > 0) run += Math.abs(zTo - zFrom) / steps;
        // channel cross-section: outer lip, floor x2, inner lip
        const section: [number, number][] = [
          [centreX - half, ground],
          [centreX - half * 0.6, ground - KENAN.gutterDepth],
          [centreX + half * 0.6, ground - KENAN.gutterDepth],
          [centreX + half, ground],
        ];
        section.forEach(([x, y], vi) => {
          positions.push(x, y, z);
          uvs.push(run / tile, vi / 3);
        });
        if (k > 0) {
          const p = (k - 1) * 4;
          const c = k * 4;
          for (let vi = 0; vi < 3; vi++) {
            index.push(p + vi, c + vi, p + vi + 1, p + vi + 1, c + vi, c + vi + 1);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(index);
      geo.computeVertexNormals();
      return geo;
    };
    return [
      build(-(KENAN.width / 2 - KENAN.gutterInset)),
      build(KENAN.width / 2 - KENAN.gutterInset),
    ];
  }, [mats]);

  const rails = useMemo(() => {
    // Centre handrail on each flight: rail bar plus support posts, oriented by
    // quaternion so the bar exactly follows the flight's pitch.
    const up = new THREE.Vector3(0, 1, 0);
    const build = (zBottom: number, zTop: number, yBottom: number, yTop: number) => {
      const dir = new THREE.Vector3(0, yTop - yBottom, zTop - zBottom);
      const length = dir.length();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
      const railHeight = 0.92;
      const posts: [number, number, number][] = [];
      for (let t = 0.08; t < 1; t += 0.2) {
        posts.push([0, yBottom + (yTop - yBottom) * t + railHeight / 2, zBottom + (zTop - zBottom) * t]);
      }
      return {
        length,
        quaternion,
        center: [0, (yBottom + yTop) / 2 + railHeight, (zBottom + zTop) / 2] as [number, number, number],
        posts,
        postHeight: railHeight,
      };
    };
    return [
      build(KENAN.bottomZ, KENAN_LANDING_Z[0], 0, KENAN_LANDING_ELEVATION),
      build(KENAN_LANDING_Z[1], KENAN_TOP_Z, KENAN_LANDING_ELEVATION, KENAN_TOTAL_RISE),
    ];
  }, []);

  const stone = surface(mats["kenan/stone-step"], { wetness: Math.max(wetness, 0.25) });
  const wall = surface(mats["kenan/retaining-wall"], { wetness });
  const damp = surface(mats["kenan/wet-concrete"], { wetness: Math.max(wetness, 0.4) });

  return (
    <group>
      {/* 132 treads */}
      <instancedMesh
        ref={treads}
        args={[treadGeo, undefined, KENAN_STEPS.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...stone} />
      </instancedMesh>

      {/* 左右護牆 — double-sided: seen from the treads and from the bank. */}
      {wallGeos.map((geo, i) => (
        <mesh key={`wall${i}`} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial {...wall} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* 排水溝 */}
      {gutterGeos.map((geo, i) => (
        <mesh key={`gutter${i}`} geometry={geo} receiveShadow>
          <meshStandardMaterial {...damp} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* 排水孔 */}
      <instancedMesh ref={grates} args={[grateGeo, undefined, drainZs.length * 2]} receiveShadow>
        <meshStandardMaterial color="#4b4d4f" roughness={0.55} metalness={0.5} />
      </instancedMesh>

      {/* 中央扶手: bar + posts on each flight */}
      {rails.map((rail, i) => (
        <group key={`rail${i}`}>
          <mesh position={rail.center} quaternion={rail.quaternion} castShadow>
            <cylinderGeometry args={[0.042, 0.042, rail.length, 8]} />
            <meshStandardMaterial color="#8c8880" roughness={0.42} metalness={0.55} />
          </mesh>
          {rail.posts.map((p, k) => (
            <mesh key={k} position={p}>
              <cylinderGeometry args={[0.03, 0.03, rail.postHeight, 6]} />
              <meshStandardMaterial color="#7c7870" roughness={0.5} metalness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 中間平台護欄柱, so the landing reads as a place to stop */}
      {([-1, 1] as const).map((s) => (
        <mesh
          key={`landingpost${s}`}
          position={[
            s * (KENAN.width / 2 + KENAN.wallThickness / 2),
            KENAN_LANDING_ELEVATION + KENAN.wallHeight + 0.35,
            (KENAN_LANDING_Z[0] + KENAN_LANDING_Z[1]) / 2,
          ]}
          castShadow
        >
          <boxGeometry args={[KENAN.wallThickness + 0.1, 0.7, KENAN.landingDepth]} />
          <meshStandardMaterial {...wall} />
        </mesh>
      ))}

      {/* 坡底入口門柱 */}
      {([-1, 1] as const).map((s) => (
        <group
          key={`pier${s}`}
          position={[s * (KENAN.bottomApronWidth / 2 + 0.5), sampleGroundElevation(0, AXIS.gateZ), AXIS.gateZ]}
        >
          <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 3.0, 1.1]} />
            <meshStandardMaterial {...surface(mats["kenan/old-wall"], { wetness })} />
          </mesh>
          <mesh position={[0, 3.12, 0]} castShadow>
            <boxGeometry args={[1.36, 0.24, 1.36]} />
            <meshStandardMaterial {...wall} />
          </mesh>
        </group>
      ))}

      {/* 坡頂銜接: a short flare where the apron meets the plaza rim */}
      <mesh
        position={[0, (KENAN_TOTAL_RISE + PLAZA_ELEVATION) / 2 - 0.16, (KENAN_TOP_Z + AXIS.plazaSouthZ) / 2]}
        receiveShadow
      >
        <boxGeometry args={[KENAN.width + 1.2, 0.3, Math.abs(KENAN_TOP_Z - AXIS.plazaSouthZ)]} />
        <meshStandardMaterial {...damp} />
      </mesh>
    </group>
  );
}
