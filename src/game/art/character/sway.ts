/** Damped secondary motion for the hair tail and the turtle charm. */

export type Spring = { x: number; vx: number; z: number; vz: number };

export function createSpring(): Spring {
  return { x: 0, vx: 0, z: 0, vz: 0 };
}

export function stepSpring(s: Spring, tx: number, tz: number, k: number, damping: number, dt: number) {
  s.vx += (k * (tx - s.x) - damping * s.vx) * dt;
  s.vz += (k * (tz - s.z) - damping * s.vz) * dt;
  s.x += s.vx * dt;
  s.z += s.vz * dt;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Rest targets when reduced motion is on. Otherwise the body velocity leads the springs. */
export function swayTargets(forward: number, side: number, accelZ: number, accelX: number, reduced: boolean) {
  if (reduced) {
    return { hairX: 0, hairZ: 0, charmX: 0, charmZ: 0 };
  }
  return {
    hairX: clamp(forward * 0.045 - accelZ * 0.004, -0.25, 0.55),
    hairZ: clamp(-side * 0.05 + accelX * 0.004, -0.4, 0.4),
    charmX: clamp(forward * 0.07 - accelZ * 0.01, -0.5, 0.9),
    charmZ: clamp(-side * 0.08 + accelX * 0.008, -0.6, 0.6),
  };
}
