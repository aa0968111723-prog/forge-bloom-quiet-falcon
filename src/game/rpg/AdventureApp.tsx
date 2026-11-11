import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, advance, useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { useGame } from "../store";
import { quality, setQualityPreference } from "../quality";
import { TITLE_ORBIT } from "./follow";
import { World } from "../world/World";
import { Npcs } from "../Npcs";
import { CAMPUS_SITES } from "./campus";
import { AdventurePlayer } from "./AdventurePlayer";
import { AdventureHud } from "./AdventureHud";
import { AdventureSystems, CampusExtension, Interior, PromptMarks } from "./AdventureWorld";
import { useRpg } from "./store";
import { usePerformance } from "./performance";
function PerformanceBudget() {
  const setDpr = useThree((s) => s.setDpr),
    gl = useThree((s) => s.gl);
  const metrics = useRef({ frames: 0, total: 0 });
  useFrame((_, delta) => {
    if (document.hidden || useGame.getState().phase !== "playing") return;
    metrics.current.frames++;
    metrics.current.total += Math.min(delta, 0.1);
    if (metrics.current.frames >= 150) {
      const average = metrics.current.total / metrics.current.frames;
      const current = gl.getPixelRatio();
      usePerformance.setState({
        fps: Math.round(1 / average),
        dpr: Math.round(current * 100) / 100,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
      if (average > 0.035 && current > 0.85)
        setDpr(Math.max(0.85, current - 0.15));
      metrics.current = { frames: 0, total: 0 };
    }
  });
  return null;
}
/**
 * QA-only deterministic clock (`?qa=1`): freeze the frame loop and advance it
 * by exact steps, so captures of fast effects do not depend on host speed.
 */
function QaClock() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("qa") !== "1") return;
    const qa = (window.__rpgQA ??= { rpg: useRpg, game: useGame });
    qa.freeze = () => setFrameloop("never");
    qa.resume = () => setFrameloop("always");
    qa.step = (dt = 1 / 30, count = 1) => {
      const state = get();
      for (let i = 0; i < count; i++) advance(state.clock.elapsedTime + dt, true, state);
    };
    return () => {
      delete qa.freeze;
      delete qa.resume;
      delete qa.step;
    };
  }, [setFrameloop, get]);
  return null;
}
function Scene({ onReady }: { onReady: () => void }) {
  const interior = useRpg((s) => s.interiorId),
    anomaly = useRpg((s) => s.anomaly),
    time = useGame((s) => s.timeOfDay);
  const discoveryAcc = useRef(0);
  useFrame((_, dt) => {
    discoveryAcc.current += dt;
    if (
      discoveryAcc.current < 0.6 ||
      interior ||
      useGame.getState().phase !== "playing"
    )
      return;
    discoveryAcc.current = 0;
    const g = useGame.getState();
    for (const s of CAMPUS_SITES)
      if (
        Math.hypot(g.playerX - s.x, g.playerZ - s.z) <
        Math.max(s.w, s.d) * 0.65 + 8
      )
        useRpg.getState().discover(s.id);
  });
  return (
    <>
      <Suspense fallback={null}>
        {interior ? (
          <Interior />
        ) : (
          <>
            <World
              onReady={onReady}
              timeOfDay={anomaly === "blackout" ? "night" : time}
            />
            <CampusExtension />
            <Npcs />
          </>
        )}
        <AdventureSystems />
        <PromptMarks />
        <AdventurePlayer />
      </Suspense>
      <PerformanceBudget />
    </>
  );
}
function Loading({ ready }: { ready: boolean }) {
  const { active, progress } = useProgress();
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setElapsed(true), 1200);
    return () => clearTimeout(t);
  }, []);
  if (elapsed && ready && !active) return null;
  return (
    <div className="ad-loading ad-asset-loading">
      <span>TKU / ENTERING THE WORLD</span>
      <h1>正在前往五虎崗</h1>
      <div>
        <i style={{ width: Math.max(4, progress) + "%" }} />
      </div>
      <p>{Math.round(progress)}% · 載入校園材質與模型</p>
    </div>
  );
}
function ContextWatch({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); if (canvas.isConnected) onLost(); };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, onLost, onRestored]);
  return null;
}
export default function AdventureApp() {
  const epoch = useGame((s) => s.sceneEpoch),
    graphics = useGame((s) => s.graphics);
  const [mounted, setMounted] = useState(false),
    [lost, setLost] = useState(false),
    [restores, setRestores] = useState(0);
  const [worldReady, setWorldReady] = useState(false);
  const onReady = useCallback(() => setWorldReady(true), []);
  const onLost = useCallback(() => setLost(true), []);
  const onRestored = useCallback(() => { setLost(false); setRestores((v) => v + 1); }, []);
  useEffect(() => {
    setQualityPreference(graphics);
    setMounted(true);
  }, [graphics]);
  useEffect(() => {
    document.title = "淡江世界 · 五虎崗異象";
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("qa") !== "1") return;
    window.__rpgQA = { rpg: useRpg, game: useGame };
    return () => {
      delete window.__rpgQA;
    };
  }, []);
  return (
    <main className="ad-app">
      {mounted && (
        <Canvas
          key={epoch + ":" + restores}
          shadows={quality().shadows}
          dpr={quality().dpr}
          camera={{
            fov: 58,
            near: 0.18,
            far: quality().drawDistance,
            position: [TITLE_ORBIT.x, TITLE_ORBIT.y, TITLE_ORBIT.z],
          }}
          gl={{
            antialias: quality().tier === "high",
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            window.__perfTest = { info: gl.info };
            setLost(false);
          }}
        >
          <Scene onReady={onReady} />
          <ContextWatch onLost={onLost} onRestored={onRestored}/>
          <QaClock />
        </Canvas>
      )}
      <AdventureHud />
      {mounted && <Loading ready={worldReady} />}
      {lost && (
        <div className="ad-loading">
          <h1>畫面正在恢復</h1>
          <p>顯示資源暫時中斷。遊戲進度已保留，請稍候或重新載入。</p>
          <button onClick={() => location.reload()}>重新載入</button>
        </div>
      )}
    </main>
  );
}
