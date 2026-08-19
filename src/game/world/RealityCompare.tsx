import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import { BENCHMARK_BY_ID, BENCHMARK_CAMERAS, deviationRows } from "../world-data/benchmarks.ts";
import { LANDMARK_BY_ID } from "../world-data/landmarks.ts";
import { REFERENCE_BY_ID } from "../world-data/references.ts";
import { worldBearingDeg } from "../world-data/origin.ts";

/**
 * Reality Compare Mode — F8.
 *
 * Developer tool, not a player feature. F8 toggles it; [ and ] (or F9) cycle
 * through the fixed benchmark cameras defined in world-data/benchmarks.ts. The
 * camera snaps to the exact stored pose so every screenshot of a benchmark is
 * pixel-comparable with the last one, and the panel prints the landmark's
 * real-vs-built dimension table with its accuracy tags and references.
 */

/** Inside-canvas half: drives the camera while a benchmark is active. */
export function RealityCameraRig() {
  const benchmarkId = useGame((s) => s.benchmarkId);
  const camera = useThree((s) => s.camera);

  useFrame(() => {
    if (!benchmarkId) return;
    const b = BENCHMARK_BY_ID[benchmarkId];
    if (!b) return;
    camera.position.set(...b.position);
    const cosP = Math.cos(b.pitch);
    camera.lookAt(
      b.position[0] - Math.sin(b.yaw) * cosP,
      b.position[1] - Math.sin(b.pitch),
      b.position[2] - Math.cos(b.yaw) * cosP,
    );
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera && persp.fov !== b.fov) {
      persp.fov = b.fov;
      persp.updateProjectionMatrix();
    }
  });
  return null;
}

/** DOM half: key bindings + data panel. Rendered by the HUD overlay. */
export function RealityComparePanel() {
  const benchmarkId = useGame((s) => s.benchmarkId);
  const setBenchmark = useGame((s) => s.setBenchmark);
  const [, force] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F8") {
        e.preventDefault();
        const cur = useGame.getState().benchmarkId;
        setBenchmark(cur ? null : BENCHMARK_CAMERAS[0].id);
        return;
      }
      const cur = useGame.getState().benchmarkId;
      if (!cur) return;
      const idx = BENCHMARK_CAMERAS.findIndex((b) => b.id === cur);
      if (e.code === "BracketRight" || e.code === "F9") {
        e.preventDefault();
        setBenchmark(BENCHMARK_CAMERAS[(idx + 1) % BENCHMARK_CAMERAS.length].id);
      } else if (e.code === "BracketLeft") {
        e.preventDefault();
        setBenchmark(
          BENCHMARK_CAMERAS[(idx - 1 + BENCHMARK_CAMERAS.length) % BENCHMARK_CAMERAS.length].id,
        );
      }
      force((n) => n + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setBenchmark]);

  const data = useMemo(() => {
    if (!benchmarkId) return null;
    const b = BENCHMARK_BY_ID[benchmarkId];
    if (!b) return null;
    const landmark = LANDMARK_BY_ID[b.landmarkId];
    return { b, landmark, rows: deviationRows(b.landmarkId) };
  }, [benchmarkId]);

  if (!data) return null;
  const { b, landmark, rows } = data;
  const fmt = (v: number, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "—");

  return (
    <div className="pointer-events-auto absolute left-3 top-16 z-40 w-[22rem] max-w-[92vw] rounded-xl border border-emerald-400/40 bg-black/78 p-3 font-mono text-[11px] leading-relaxed text-emerald-100 shadow-lg backdrop-blur">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-emerald-300">Reality Compare</p>
        <p className="text-[10px] text-emerald-200/60">F8 關閉 · [ ] 切換</p>
      </div>
      <p className="mt-1 text-emerald-200">
        {b.id} · {b.label}
      </p>
      <table className="mt-1 w-full">
        <tbody>
          <tr>
            <td className="pr-2 text-emerald-200/60">Camera</td>
            <td>
              {fmt(b.position[0], 1)}, {fmt(b.position[1], 1)}, {fmt(b.position[2], 1)}
            </td>
          </tr>
          <tr>
            <td className="pr-2 text-emerald-200/60">Yaw / Pitch</td>
            <td>
              {fmt((b.yaw * 180) / Math.PI, 1)}° / {fmt((b.pitch * 180) / Math.PI, 1)}° · 朝{" "}
              {fmt(worldBearingDeg(-Math.sin(b.yaw), -Math.cos(b.yaw)), 0)}°N
            </td>
          </tr>
          <tr>
            <td className="pr-2 text-emerald-200/60">FOV / Time</td>
            <td>
              {b.fov}° / {b.time}
            </td>
          </tr>
          <tr>
            <td className="pr-2 text-emerald-200/60">Landmark</td>
            <td>
              {landmark.name}（{landmark.accuracy}）
            </td>
          </tr>
          <tr>
            <td className="pr-2 align-top text-emerald-200/60">Refs</td>
            <td>
              {b.referenceIds.map((id) => (
                <span key={id} title={REFERENCE_BY_ID[id]?.claim} className="mr-1 inline-block">
                  {id.replace("REF_", "")}
                </span>
              ))}
            </td>
          </tr>
        </tbody>
      </table>

      {rows.length > 0 && (
        <table className="mt-2 w-full border-t border-emerald-400/20 pt-1">
          <thead>
            <tr className="text-emerald-200/60">
              <td>尺寸</td>
              <td className="text-right">real</td>
              <td className="text-right">game</td>
              <td className="text-right">Δ</td>
              <td className="pl-1">acc</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={Math.abs(r.deviation) > 0.05 ? "text-amber-300" : ""}>
                <td>{r.label}</td>
                <td className="text-right tabular-nums">{fmt(r.real)}</td>
                <td className="text-right tabular-nums">{fmt(r.game)}</td>
                <td className="text-right tabular-nums">{fmt(r.deviation)}</td>
                <td className="pl-1 text-emerald-200/60">{r.accuracy[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ul className="mt-2 list-disc border-t border-emerald-400/20 pl-4 pt-1 text-emerald-100/80">
        {b.checks.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}
