import { sampleGroundElevation } from "../../world-data/elevation.ts";
import { KENAN, kenanSection } from "../../world-data/kenan.ts";
import type { Accuracy } from "../../world-data/origin.ts";
import { pavedAt } from "../../world-data/paths.ts";

/** Geometric classes only. Not a site survey of surface materials. */
export type SurfaceKind = "grass" | "stone" | "pave";

export const SURFACE_FRICTION: Record<SurfaceKind, number> = {
  grass: 0.32,
  stone: 0.58,
  pave: 0.8,
};

/** One Kenan riser is 0.162 m. This clears one tread and refuses two. */
export const STEP_UP_M = 0.22;

/** Rise/run above this, and taller than a step, is not walked up. */
export const MAX_CLIMB_GRADE = 0.7;

export const GRAVITY = 9.81;

export type ContactSample = {
  /** Metres above the slope-foot datum. Same value as sampleGroundElevation. */
  height: number;
  /** Dimensionless rise over run from a 0.5 m cross. */
  slope: number;
  slopeDeg: number;
  surface: SurfaceKind;
  friction: number;
  /** No tape or survey was used. See basis. */
  accuracy: Accuracy;
  basis: "geometric";
};

const SAMPLE = 0.5;
const APRON_HALF = KENAN.bottomApronWidth / 2;

function onStairs(x: number, z: number) {
  const section = kenanSection(z);
  if (section !== "lower-flight" && section !== "upper-flight" && section !== "landing")
    return false;
  return Math.abs(x) <= KENAN.width / 2 + 0.05;
}

function onApron(x: number, z: number) {
  const section = kenanSection(z);
  if (section !== "bottom-apron" && section !== "top-apron") return false;
  return Math.abs(x) <= APRON_HALF + 0.4;
}

/**
 * Class from existing geometry: stair treads and the mid landing are stone,
 * pavedAt plus the slope aprons are pave, everything else is grass.
 */
export function classifySurface(x: number, z: number): SurfaceKind {
  if (onStairs(x, z)) return "stone";
  if (onApron(x, z) || pavedAt(x, z)) return "pave";
  return "grass";
}

export function sampleContact(x: number, z: number): ContactSample {
  const height = sampleGroundElevation(x, z);
  const yL = sampleGroundElevation(x - SAMPLE, z);
  const yR = sampleGroundElevation(x + SAMPLE, z);
  const yN = sampleGroundElevation(x, z - SAMPLE);
  const yS = sampleGroundElevation(x, z + SAMPLE);
  const dydx = (yR - yL) / (2 * SAMPLE);
  const dydz = (yS - yN) / (2 * SAMPLE);
  const slope = Math.hypot(dydx, dydz);
  const surface = classifySurface(x, z);
  return {
    height,
    slope,
    slopeDeg: (Math.atan(slope) * 180) / Math.PI,
    surface,
    friction: SURFACE_FRICTION[surface],
    accuracy: "estimated",
    basis: "geometric",
  };
}
