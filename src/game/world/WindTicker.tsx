import { useFrame } from "@react-three/fiber";
import { useReducedArtMotion } from "../art/motion";
import { stepWind } from "./wind";
import type { TimeOfDay } from "../world-data/lighting.ts";

/** How hard the wind blows in each weather. Tamsui is never still. */
const STRENGTH: Record<TimeOfDay, number> = {
  day: 1,
  cloudy: 1.5,
  sunset: 0.8,
  night: 0.55,
  wet: 1.25,
};

export function WindTicker({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const reduced = useReducedArtMotion();
  useFrame((_, delta) => {
    stepWind(delta, STRENGTH[timeOfDay], reduced);
  });
  return null;
}
