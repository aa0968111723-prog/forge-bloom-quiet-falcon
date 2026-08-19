import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { quality } from "@/game/quality";
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
      <p className="font-display text-3xl">淡江世界</p>
      <p className="mt-2 text-sm tracking-[0.2em] text-paper/70">載入五虎崗</p>
      <div className="mt-6 h-1.5 w-44 overflow-hidden rounded-full bg-paper/15">
        <div
          className="h-full bg-paper transition-[width] duration-200"
          style={{ width: `${Math.max(8, Math.round(progress))}%` }}
        />
      </div>
    </div>
  );
}

export function CampusGame() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-navy-deep" style={{ touchAction: "none" }}>
      {mounted ? (
        <Canvas
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
