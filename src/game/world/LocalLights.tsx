import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { quality } from "../quality";
import { useGame } from "../store";
import { localLightCatalog, type LocalLight } from "../world-data/local-lights.ts";

/**
 * Nearest lantern / window / street-lamp point lights, gated by lampsOn.
 * The catalog is the source of truth; this only picks a quality-capped subset
 * around the player so a night walk stays lit without 80 simultaneous lights.
 */
export function LocalLights({ lampsOn }: { lampsOn: boolean }) {
  const q = quality();
  const catalog = useMemo(() => localLightCatalog(), []);
  const [visible, setVisible] = useState<LocalLight[]>(() => catalog.slice(0, q.maxLampLights));
  const acc = useRef(0);

  useFrame((_, dt) => {
    if (!lampsOn) return;
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const { playerX, playerZ } = useGame.getState();
    const ranked = catalog
      .map((l) => ({ l, d: (l.x - playerX) ** 2 + (l.z - playerZ) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, q.maxLampLights)
      .map((row) => row.l);
    setVisible((previous) => previous.map((l) => l.id).join(",") === ranked.map((l) => l.id).join(",") ? previous : ranked);
  });

  if (!lampsOn) return null;
  return (
    <group>
      {visible.map((l) => (
        <pointLight
          key={l.id}
          position={[l.x, l.y, l.z]}
          color={l.color}
          intensity={l.intensity}
          distance={l.distance}
          decay={2}
        />
      ))}
    </group>
  );
}
