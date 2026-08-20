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
  // Radius within which a tree uses its detailed model. The vendored canopies
  // are ~2.5k triangles each, so a generous radius silently costs millions;
  // past ~110 m the cheap blob is visually indistinguishable.
  vegetationRange: 110,
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
  vegetationRange: 70,
  propRange: 90,
  drawDistance: 520,
  terrainStep: 4,
  maxLampLights: 3,
  dpr: [1, 1.25],
  simpleTrees: true,
};

/** Player preference, injected at boot so this module stays dependency-free. */
let preference: { tier: "auto" | "high" | "low"; postFx: boolean } = {
  tier: "auto",
  postFx: true,
};

/**
 * Apply the saved graphics preference. Called once before the canvas mounts;
 * the detected tier is recomputed so an explicit choice always wins.
 */
export function setQualityPreference(pref: { tier: "auto" | "high" | "low"; postFx: boolean }) {
  preference = pref;
  cached = null;
}

/** Whether the post-processing chain should run at all. */
export function postFxEnabled(): boolean {
  if (typeof window !== "undefined") {
    const forced = new URLSearchParams(window.location.search).get("postfx");
    if (forced === "off") return false;
    if (forced === "on") return true;
  }
  return preference.postFx && quality().tier === "high";
}

function detect(): QualitySettings {
  if (typeof window === "undefined") return HIGH;
  const forced = new URLSearchParams(window.location.search).get("q");
  if (forced === "low") return LOW;
  if (forced === "high") return HIGH;
  if (preference.tier === "low") return LOW;
  if (preference.tier === "high") return HIGH;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const small = Math.min(window.innerWidth, window.innerHeight) < 620;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  // Touch input and a small viewport are the reliable signals. Core count is
  // not: plenty of capable laptops report 4, and demoting them costs the whole
  // stylised look for no reason. Only genuinely tiny machines drop to LOW.
  return coarse || small || cores <= 2 || memory <= 2 ? LOW : HIGH;
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
