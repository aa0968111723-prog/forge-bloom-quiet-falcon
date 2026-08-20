import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { quality } from "../quality";
import { TIME_PRESETS, type TimeOfDay } from "../world-data/lighting.ts";
import { applyToon, STYLE } from "./stylize";

/**
 * Installs the stylised lighting model across the scene and keeps its
 * parameters in step with the weather.
 *
 * Materials are created over the first few frames (Suspense resolving, LOD
 * swaps, lazily built geometry), so rather than patch at a hundred call sites
 * this sweeps the graph a bounded number of times at low frequency and then
 * stops. Patching is idempotent, so repeat sweeps are free.
 *
 * Foliage is detected by name: the vendored Quaternius canopies use "Green" /
 * "DarkGreen" material names, and the procedural canopy blobs are tagged when
 * they are built.
 */
const SWEEP_FRAMES = 240;
const SWEEP_EVERY = 8;

function isFoliage(material: THREE.Material): boolean {
  const name = material.name ?? "";
  return (
    material.userData?.foliage === true ||
    name === "Green" ||
    name === "DarkGreen" ||
    name === "Leaves"
  );
}

/** Rim/transmission character per weather. */
const STYLE_BY_TIME: Record<
  TimeOfDay,
  { rim: string; rimStrength: number; trans: string; transStrength: number; steps: number; mix: number }
> = {
  day: { rim: "#d7ecf8", rimStrength: 0.16, trans: "#9ccb63", transStrength: 0.3, steps: 4, mix: 0.6 },
  // Overcast light wraps: almost no rim, very soft banding.
  cloudy: { rim: "#dfe6ea", rimStrength: 0.08, trans: "#8aa86a", transStrength: 0.12, steps: 5, mix: 0.36 },
  // Golden hour: warm rim and a canopy glowing from behind — the strongest
  // stylisation of the five, but still short of washing the frame out.
  sunset: { rim: "#ffc98e", rimStrength: 0.3, trans: "#ffb765", transStrength: 0.7, steps: 3, mix: 0.7 },
  night: { rim: "#8fa6c8", rimStrength: 0.22, trans: "#2c4460", transStrength: 0.08, steps: 3, mix: 0.6 },
  wet: { rim: "#cdd8de", rimStrength: 0.14, trans: "#7f9a63", transStrength: 0.14, steps: 4, mix: 0.44 },
};

export function StylizePass({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const scene = useThree((s) => s.scene);
  const frame = useRef(0);
  const target = STYLE_BY_TIME[timeOfDay];
  const preset = TIME_PRESETS[timeOfDay];
  const q = quality();

  useFrame((_, delta) => {
    // Bounded sweep: catch materials as they appear, then leave the graph alone.
    if (frame.current < SWEEP_FRAMES) {
      if (frame.current % SWEEP_EVERY === 0) {
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          const mat = mesh.material;
          if (!mat) return;
          for (const m of Array.isArray(mat) ? mat : [mat]) applyToon(m, isFoliage(m));
        });
      }
      frame.current += 1;
    }

    // Ease the stylisation toward the current weather.
    const k = 1 - Math.exp(-2.2 * delta);
    (STYLE.rimColor.value as THREE.Color).lerp(new THREE.Color(target.rim), k);
    (STYLE.transColor.value as THREE.Color).lerp(new THREE.Color(target.trans), k);
    STYLE.rimStrength.value += (target.rimStrength - STYLE.rimStrength.value) * k;
    STYLE.transStrength.value += (target.transStrength - STYLE.transStrength.value) * k;
    STYLE.toonSteps.value += (target.steps - STYLE.toonSteps.value) * k;
    // The low tier softens the banding: without normal maps the hard bands
    // read as flat blotches rather than as painted shading.
    const mix = q.tier === "high" ? target.mix : target.mix * 0.6;
    STYLE.toonMix.value += (mix - STYLE.toonMix.value) * k;
    (STYLE.sunDir.value as THREE.Vector3)
      .lerp(new THREE.Vector3(...preset.sunPos).normalize(), k)
      .normalize();
  });

  return null;
}
