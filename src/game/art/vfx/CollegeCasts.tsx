import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedArtMotion } from "../../art/motion";
import { quality } from "../../quality";
import { useGame } from "../../store";
import { terrainHeight } from "../../world";
import { DEPARTMENTS } from "../../rpg/data";
import { useRpg } from "../../rpg/store";
import { COLLEGE_CASTS, COLLEGE_CAST_LIFE, buildCollegeCasts, layoutCollegeCast, type CollegeCast } from "./college-casts";

const isCollege = (id: string | undefined): id is CollegeCast =>
  Boolean(id && (COLLEGE_CASTS as readonly string[]).includes(id));

/**
 * Draws whichever of the eight non-engineering college skills the player has
 * equipped. Engineering stays with StructuralPulse. Combat numbers come from
 * the live `attackFx` record.
 */
export function CollegeCasts() {
  const reduced = useReducedArtMotion();
  const low = quality().tier === "low";
  const root = useMemo(() => buildCollegeCasts(!low), [low]);
  useEffect(
    () => () => {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material && !Array.isArray(mesh.material)) materials.add(mesh.material);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
    [root],
  );
  const state = useRef({
    castAt: useRpg.getState().attackFx?.at ?? -1,
    age: Infinity,
    range: 12,
    yaw: 0,
    center: new THREE.Vector3(),
    hits: [] as { x: number; y: number; z: number }[],
  });

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.08);
    const rpg = useRpg.getState();
    const discipline = DEPARTMENTS.find((d) => d.id === rpg.departmentId)?.discipline;
    const mine = isCollege(discipline);
    const fx = rpg.attackFx;
    const st = state.current;
    if (mine && fx?.skill && fx.at !== st.castAt) {
      st.castAt = fx.at;
      st.age = 0;
      st.range = fx.range;
      st.yaw = fx.yaw;
      st.center.set(fx.x, terrainHeight(fx.x, fx.z), fx.z);
      st.hits = fx.hits
        .map((id) => rpg.enemies.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .slice(0, 8)
        .map((e) => ({ x: e.x, y: terrainHeight(e.x, e.z), z: e.z }));
    } else if (fx && fx.at !== st.castAt) {
      st.castAt = fx.at;
    }
    st.age += dt;
    for (const child of root.children) child.visible = false;
    const showing = mine && fx?.skill && fx.at === st.castAt && st.age < COLLEGE_CAST_LIFE && !rpg.interiorId;
    if (!showing || !mine) return;
    const group = root.getObjectByName(discipline);
    if (!group) return;
    const player = useGame.getState();
    group.visible = layoutCollegeCast(group, {
      age: st.age,
      range: st.range,
      yaw: st.yaw,
      reduced,
      center: st.center,
      hits: st.hits,
      player: { x: player.playerX, y: terrainHeight(player.playerX, player.playerZ), z: player.playerZ },
    });
  });

  return <primitive object={root} />;
}
