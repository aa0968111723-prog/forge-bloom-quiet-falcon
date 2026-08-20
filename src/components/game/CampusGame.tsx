import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { quality, setQualityPreference } from "@/game/quality";
import { useProgress } from "@react-three/drei";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadPilgrimage, savePilgrimage } from "@/lib/pilgrimage";
import { loadLocal } from "@/game/save";
import { useGame } from "@/game/store";
import { GameScene } from "@/game/Scene";
import { GameOverlay } from "./Overlay";

function CloudSync() {
  const { user, isPending } = useCurrentUserState();
  const visited = useGame((s) => s.visited);

  useEffect(() => {
    if (isPending || !user) return;
    void loadPilgrimage()
      .then((data) => {
        useGame.getState().hydrate({
          ...loadLocal(),
          visited: data.visited,
        });
      })
      .catch(() => {
        /* guest / unauthorized */
      });
  }, [user, isPending]);

  useEffect(() => {
    if (!user) return;
    const t = window.setTimeout(() => {
      void savePilgrimage({ data: { visited, playSeconds: 0 } }).catch(() => {});
    }, 700);
    return () => window.clearTimeout(t);
  }, [visited, user]);

  return null;
}

function LoadScrim() {
  const { active, progress } = useProgress();
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setDone(true), 2000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!active && progress >= 99) setDone(true);
  }, [active, progress]);
  if (done) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-navy-deep text-paper">
      <p className="text-[10px] tracking-[0.5em] text-paper/50">TAMKANG · TAMSUI</p>
      <p className="mt-3 font-display text-4xl tracking-wide">淡江世界</p>
      <p className="mt-2 text-sm tracking-[0.3em] text-paper/60">載入五虎崗</p>
      <div className="mt-7 h-[3px] w-56 overflow-hidden rounded-full bg-paper/12">
        <div
          className="h-full rounded-full bg-gradient-to-r from-paper/60 to-paper transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(6, Math.round(progress))}%` }}
        />
      </div>
      <p className="mt-4 text-[11px] tabular-nums tracking-[0.18em] text-paper/35">
        {Math.max(0, Math.round(progress))}%
      </p>
    </div>
  );
}

export function CampusGame() {
  const [mounted, setMounted] = useState(false);
  const sceneEpoch = useGame((s) => s.sceneEpoch);
  const graphics = useGame((s) => s.graphics);

  useEffect(() => {
    // Saved preference must land before anything reads quality().
    setQualityPreference(graphics);
    setMounted(true);
  }, [graphics]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-navy-deep" style={{ touchAction: "none" }}>
      {mounted ? (
        <Canvas
          key={sceneEpoch}
          className="absolute inset-0"
          shadows={quality().shadows}
          dpr={quality().dpr}
          camera={{
            fov: 58,
            near: 0.18,
            far: quality().drawDistance,
            position: [-13, 31.5, 13],
          }}
          gl={{ antialias: quality().tier === "high", powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setClearColor("#e8965a");
            // Perf probe for the regression harness (dev + prod, negligible cost).
            window.__perfTest = { info: gl.info };
          }}
        >
          <Suspense fallback={null}>
            <GameScene />
          </Suspense>
        </Canvas>
      ) : (
        <div className="absolute inset-0 bg-navy-deep" />
      )}
      {mounted && <LoadScrim />}
      <div className="pointer-events-none absolute inset-0 z-30">
        <GameOverlay />
      </div>
      <CloudSync />
    </div>
  );
}
