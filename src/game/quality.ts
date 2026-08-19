/**
 * Quality tiers.
 *
 * Reality Pass v1 must not turn the campus into a desktop-only scene, so every
 * expensive decision (shadow maps, planting density, prop range, terrain
 * resolution, which texture maps even get downloaded) reads from here rather
 * than being hardcoded in a component.
 *
 * Override with `?q=low` / `?q=high` — the visual-regression run uses it so both
 * tiers can be captured from one build.
 */
export type QualityTier = "high" | "low";

export type QualitySettings = {
  tier: QualityTier;
  /** Sun shadows at all. */
  shadows: boolean;
  shadowMapSize: number;
  /** Half-extent of the sun's orthographic shadow camera, metres. */
  shadowExtent: number;
  /** 0..1 multiplier on backdrop scatter planting. */
  vegetationDensity: number;
  /** Curated planting beyond this distance from the camera is skipped. */
  vegetationRange: number;
  /** Props beyond this distance are skipped. */
  propRange: number;
  /** Camera far plane, metres. */
  drawDistance: number;
  /** Terrain grid spacing through the reality corridor, metres. */
  terrainStep: number;
  /** Max simultaneous lantern / lamp point lights. */
  maxLampLights: number;
  /** Renderer pixel-ratio clamp. */
  dpr: [number, number];
  /** Use the cheap single-blob tree instead of the branched one. */
  simpleTrees: boolean;
};

const HIGH: QualitySettings = {
  tier: "high",
  shadows: true,
  shadowMapSize: 2048,
  shadowExtent: 90,
  vegetationDensity: 0.85,
  vegetationRange: 260,
  propRange: 190,
  drawDistance: 900,
  terrainStep: 2,
  maxLampLights: 8,
  dpr: [1, 1.75],
  simpleTrees: false,
};

const LOW: QualitySettings = {
  tier: "low",
  // Overcast presets already carry almost no sun shadow, and on a phone the
  // shadow pass is the single biggest win available.
  shadows: false,
  shadowMapSize: 512,
  shadowExtent: 60,
  vegetationDensity: 0.3,
  vegetationRange: 130,
  propRange: 90,
  drawDistance: 520,
  terrainStep: 4,
  maxLampLights: 3,
  dpr: [1, 1.25],
  simpleTrees: true,
};

function detect(): QualitySettings {
  if (typeof window === "undefined") return HIGH;
  const forced = new URLSearchParams(window.location.search).get("q");
  if (forced === "low") return LOW;
  if (forced === "high") return HIGH;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const small = Math.min(window.innerWidth, window.innerHeight) < 620;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return coarse || small || cores <= 4 || memory <= 4 ? LOW : HIGH;
}

let cached: QualitySettings | null = null;

export function quality(): QualitySettings {
  if (!cached) cached = detect();
  return cached;
}

/** Test seam: force a tier regardless of the device. */
export function setQualityTier(tier: QualityTier) {
  cached = tier === "low" ? LOW : HIGH;
}

export const QUALITY_PRESETS = { high: HIGH, low: LOW };
