import type { Accuracy } from "./origin.ts";

/**
 * 克難坡 — Reality Benchmark #1
 * ============================
 *
 * The slope is the one place on this campus where a wrong dimension is
 * immediately obvious to anyone who has climbed it, so it is modelled from an
 * explicit spec instead of eyeballed geometry. Everything else in the file is
 * derived from {@link KENAN}: the 132 individual treads, the mid landing, the
 * retaining walls, the ground-height function the player walks on, and the
 * smooth ramp the terrain mesh uses underneath the tread geometry.
 *
 * Two numbers drive the whole slope: the riser and the tread. Measure those on
 * site and the entire reconstruction re-calibrates itself.
 *
 * Geometry convention: the stair climbs towards north (-Z). Step 1 is the
 * lowest, step 132 is the highest; step `k`'s tread top sits at `k * riser`
 * above the datum (y = 0 is the bottom apron).
 */
export const KENAN = {
  id: "kenan",
  /** Documented: the slope is literally named "the 132 steps". */
  stepCount: 132,
  stepCountAccuracy: "mapped" as Accuracy,

  /** Two flights split by one landing. The split itself is a placeholder. */
  flightSteps: [66, 66] as const,
  flightSplitAccuracy: "estimated" as Accuracy,

  /** Typical Taiwanese outdoor stone stair. */
  riser: 0.162,
  tread: 0.32,
  stepAccuracy: "estimated" as Accuracy,

  /** Clear walking width between the retaining walls. */
  width: 8.0,
  widthAccuracy: "estimated" as Accuracy,

  /** Depth of the intermediate landing (中間平台), measured along the climb. */
  landingDepth: 6.0,

  /** Paved apron at the bottom entrance (坡底入口). */
  bottomApronDepth: 12.0,
  bottomApronWidth: 13.0,

  /** Apron between the top step and the plaza edge (坡頂銜接). */
  topApronDepth: 16.76,

  /** Retaining walls (左右護牆): thickness, and parapet height above the tread. */
  wallThickness: 0.45,
  wallHeight: 1.15,

  /** Open drainage channel (排水溝) inside each wall + grate spacing (排水孔). */
  gutterWidth: 0.36,
  gutterDepth: 0.12,
  gutterInset: 0.42,
  drainSpacing: 7.8,

  /** World Z of the bottom-most tread nosing. */
  bottomZ: 76.0,

  referenceIds: [
    "REF_KENAN_STEP_COUNT",
    "REF_KENAN_TWO_FLIGHTS",
    "REF_STAIR_TYPICAL_RISE",
  ] as const,
} as const;

/** Total climb of the slope, in metres. 132 × 0.162 m. */
export const KENAN_TOTAL_RISE = KENAN.stepCount * KENAN.riser;

/** Total horizontal run of the stair itself, landing included. */
export const KENAN_TOTAL_RUN = KENAN.stepCount * KENAN.tread + KENAN.landingDepth;

/** Average grade of the stair (rise / run), ignoring the aprons. */
export const KENAN_AVERAGE_GRADE = KENAN_TOTAL_RISE / KENAN_TOTAL_RUN;

export type KenanStep = {
  /** 1-based, 1 = lowest tread, 132 = highest. */
  index: number;
  /** 0 = lower flight, 1 = upper flight. */
  flight: 0 | 1;
  /** Elevation of the walking surface of this tread. */
  treadTop: number;
  /** Z of the nosing (the downhill, high-Z edge of the tread). */
  nosingZ: number;
  /** Z of the back of the tread (uphill, low-Z edge). */
  backZ: number;
};

function buildSteps(): KenanStep[] {
  const steps: KenanStep[] = [];
  const [flightA] = KENAN.flightSteps;
  let z: number = KENAN.bottomZ;
  for (let k = 1; k <= KENAN.stepCount; k++) {
    // The landing interrupts the run between the two flights.
    if (k === flightA + 1) z -= KENAN.landingDepth;
    const nosingZ = z;
    const backZ = z - KENAN.tread;
    steps.push({
      index: k,
      flight: k <= flightA ? 0 : 1,
      treadTop: k * KENAN.riser,
      nosingZ,
      backZ,
    });
    z = backZ;
  }
  return steps;
}

export const KENAN_STEPS: readonly KenanStep[] = buildSteps();

/** Elevation of the mid landing (top of the lower flight). */
export const KENAN_LANDING_ELEVATION = KENAN.flightSteps[0] * KENAN.riser;
/** Z range of the mid landing, high-Z (downhill) edge first. */
export const KENAN_LANDING_Z: readonly [number, number] = [
  KENAN.bottomZ - KENAN.flightSteps[0] * KENAN.tread,
  KENAN.bottomZ - KENAN.flightSteps[0] * KENAN.tread - KENAN.landingDepth,
];

/** Z of the back edge of the top tread — where the stair meets the top apron. */
export const KENAN_TOP_Z = KENAN_STEPS[KENAN_STEPS.length - 1].backZ;
/** Z of the downhill edge of the bottom apron (the 坡底 entrance line). */
export const KENAN_APRON_SOUTH_Z = KENAN.bottomZ + KENAN.bottomApronDepth;
/** Z where the top apron hands over to 驚聲銅像廣場. */
export const KENAN_TOP_APRON_Z = KENAN_TOP_Z - KENAN.topApronDepth;

/** Half-width of the walkable corridor, i.e. out to the inner wall face. */
export const KENAN_HALF_WIDTH = KENAN.width / 2;

export type KenanSection = "south-approach" | "bottom-apron" | "lower-flight" | "landing" | "upper-flight" | "top-apron";

/** Which part of the slope a given Z belongs to, or null if outside it. */
export function kenanSection(z: number): KenanSection | null {
  if (z > KENAN_APRON_SOUTH_Z + 14) return null;
  if (z > KENAN_APRON_SOUTH_Z) return "south-approach";
  if (z > KENAN.bottomZ) return "bottom-apron";
  if (z > KENAN_LANDING_Z[0]) return "lower-flight";
  if (z > KENAN_LANDING_Z[1]) return "landing";
  if (z > KENAN_TOP_Z) return "upper-flight";
  if (z > KENAN_TOP_APRON_Z) return "top-apron";
  return null;
}

/**
 * Walking-surface elevation on the slope centreline: the actual stepped
 * profile, so the player's feet land on tread tops and never mid-riser.
 *
 * Returns null north of the top apron, where 驚聲銅像廣場 takes over.
 * @param plazaElevation elevation of the plaza the top apron blends into.
 */
export function kenanStepElevation(z: number, plazaElevation: number): number | null {
  const section = kenanSection(z);
  if (section === null) return null;
  switch (section) {
    case "south-approach":
    case "bottom-apron":
      return 0;
    case "landing":
      return KENAN_LANDING_ELEVATION;
    case "top-apron": {
      // Gentle blend from the top tread up to the plaza surface.
      const t = (KENAN_TOP_Z - z) / KENAN.topApronDepth;
      return KENAN_TOTAL_RISE + (plazaElevation - KENAN_TOTAL_RISE) * t;
    }
    default: {
      // Inside a flight: find the tread whose span contains z.
      const step = stepAtZ(z);
      return step ? step.treadTop : null;
    }
  }
}

/** The tread a given Z falls on, or null if z is on an apron / landing. */
export function stepAtZ(z: number): KenanStep | null {
  for (const s of KENAN_STEPS) {
    if (z <= s.nosingZ && z > s.backZ) return s;
  }
  return null;
}

/**
 * Smooth ramp through the middle of the stair. The terrain mesh uses this so
 * that it stays hidden a few centimetres below the tread geometry instead of
 * fighting it, while still being watertight with the surrounding hillside.
 */
export function kenanRampElevation(z: number, plazaElevation: number): number | null {
  const section = kenanSection(z);
  if (section === null) return null;
  switch (section) {
    case "south-approach":
    case "bottom-apron":
      return 0;
    case "lower-flight": {
      const t = (KENAN.bottomZ - z) / (KENAN.flightSteps[0] * KENAN.tread);
      return t * KENAN_LANDING_ELEVATION;
    }
    case "landing":
      return KENAN_LANDING_ELEVATION;
    case "upper-flight": {
      const t = (KENAN_LANDING_Z[1] - z) / (KENAN.flightSteps[1] * KENAN.tread);
      return KENAN_LANDING_ELEVATION + t * (KENAN_TOTAL_RISE - KENAN_LANDING_ELEVATION);
    }
    case "top-apron": {
      const t = (KENAN_TOP_Z - z) / KENAN.topApronDepth;
      return KENAN_TOTAL_RISE + (plazaElevation - KENAN_TOTAL_RISE) * t;
    }
  }
}

/** Where the drainage grates sit along the climb. */
export function kenanDrainPositions(): number[] {
  const zs: number[] = [];
  for (let z = KENAN.bottomZ - 1.4; z > KENAN_TOP_Z; z -= KENAN.drainSpacing) zs.push(z);
  return zs;
}
