/**
 * Local lantern and window lights.
 *
 * Positions are derived from the same props / halls / secondary buildings that
 * draw the geometry, so a lamp can never drift off its post. Intensity is
 * gated by the time preset's `lampsOn` flag — daytime returns the same
 * positions at intensity 0 (or an empty active set).
 */

import { sampleGroundElevation } from "./elevation.ts";
import { TIME_PRESETS, type TimeOfDay } from "./lighting.ts";
import { LIBRARY, PALACE, palaceHallZs } from "./landmarks.ts";
import { propsOfKind } from "./props.ts";
import { SECONDARY_STRUCTURES } from "./zones/secondary.ts";

export type LocalLightKind = "lantern" | "window" | "street-lamp";

export type LocalLight = {
  id: string;
  kind: LocalLightKind;
  x: number;
  y: number;
  z: number;
  color: string;
  /** Intensity when lamps are on. Zero when the preset has lamps off. */
  intensity: number;
  distance: number;
};

function lanternLights(): LocalLight[] {
  return propsOfKind("lantern-post").map((p, i) => ({
    id: `lantern-${i}`,
    kind: "lantern" as const,
    x: p.x,
    y: sampleGroundElevation(p.x, p.z) + 4.2,
    z: p.z,
    color: "#ffbc74",
    intensity: 9,
    distance: 26,
  }));
}

function streetLampLights(): LocalLight[] {
  return propsOfKind("street-lamp").map((p, i) => ({
    id: `street-${i}`,
    kind: "street-lamp" as const,
    x: p.x,
    y: sampleGroundElevation(p.x, p.z) + 4.4,
    z: p.z,
    color: "#e8ecf4",
    intensity: 7,
    distance: 22,
  }));
}

function palaceWindowLights(): LocalLight[] {
  const out: LocalLight[] = [];
  for (const z of palaceHallZs()) {
    for (const side of [-1, 1] as const) {
      const x = side * PALACE.offsetX;
      out.push({
        id: `palace-window-${side}-${z}`,
        kind: "window",
        x,
        y: sampleGroundElevation(x, z) + 2.4,
        z,
        color: "#ffd8a0",
        intensity: 6.5,
        distance: 14,
      });
    }
  }
  return out;
}

function libraryWindowLights(): LocalLight[] {
  const out: LocalLight[] = [];
  const y0 = sampleGroundElevation(LIBRARY.center[0], LIBRARY.center[1]);
  for (let f = 1; f <= 4; f++) {
    for (const dx of [-18, 0, 18]) {
      out.push({
        id: `library-window-${f}-${dx}`,
        kind: "window",
        x: LIBRARY.center[0] + dx,
        y: y0 + f * LIBRARY.floorHeight + 1.2,
        z: LIBRARY.center[1] + LIBRARY.length / 2 + 0.4,
        color: "#ffe6b4",
        intensity: 8,
        distance: 18,
      });
    }
  }
  return out;
}

function campusWindowLights(): LocalLight[] {
  const out: LocalLight[] = [];
  for (const s of SECONDARY_STRUCTURES) {
    if (s.kind === "court" || s.kind === "ship") continue;
    const y = sampleGroundElevation(s.position[0], s.position[1]);
    const floors = Math.max(1, Math.min(s.floors ?? 2, 6));
    for (let f = 0; f < floors; f += 2) {
      out.push({
        id: `campus-window-${s.id}-${f}`,
        kind: "window",
        x: s.position[0],
        y: y + ((f + 0.6) * s.size[1]) / Math.max(floors, 1),
        z: s.position[1] + s.size[2] / 2 + 0.3,
        color: "#ffe6b4",
        intensity: 7,
        distance: 16,
      });
    }
  }
  return out;
}

/** All local lights at their "on" intensity. */
export function localLightCatalog(): LocalLight[] {
  return [
    ...lanternLights(),
    ...streetLampLights(),
    ...palaceWindowLights(),
    ...libraryWindowLights(),
    ...campusWindowLights(),
  ];
}

/**
 * Lights for a lamps-on flag. When off, every light is present at intensity 0
 * so callers can assert "none or zero" without a second table.
 */
export function lightsForLamps(lampsOn: boolean): LocalLight[] {
  const all = localLightCatalog();
  if (lampsOn) return all;
  return all.map((l) => ({ ...l, intensity: 0 }));
}

export function lightsForTime(time: TimeOfDay): LocalLight[] {
  return lightsForLamps(TIME_PRESETS[time].lampsOn);
}

/** Lights that actually shine (intensity > 0). */
export function shiningLights(lampsOn: boolean): LocalLight[] {
  return lightsForLamps(lampsOn).filter((l) => l.intensity > 0);
}
