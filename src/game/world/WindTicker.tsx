import { useFrame } from "@react-three/fiber";
import { tickWind, WIND } from "./wind";
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
  useFrame((_, delta) => {
    tickWind(Math.min(delta, 0.08));
    const target = STRENGTH[timeOfDay];
    WIND.strength.value += (target - WIND.strength.value) * Math.min(1, delta * 2);
  });
  return null;
}
