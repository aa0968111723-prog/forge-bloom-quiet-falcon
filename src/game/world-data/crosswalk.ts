import { AXIS } from "./axis.ts";

/**
 * Zebra bars on the south apron, between the gate piers.
 * People cross 水源街 into the slope. Flat paint, not a curb.
 * The span is estimated.
 */
export const GATE_CROSSWALK = {
  z: AXIS.gateZ - 1.6,
  bars: 6,
  barWidth: 0.42,
  gap: 0.42,
  length: 2.4,
};

export function gateCrosswalkBars() {
  const { bars, barWidth, gap, z, length } = GATE_CROSSWALK;
  const span = bars * barWidth + (bars - 1) * gap;
  const start = -span / 2 + barWidth / 2;
  const step = barWidth + gap;
  return Array.from({ length: bars }, (_, i) => ({
    x: start + i * step,
    z,
    w: barWidth,
    d: length,
  }));
}
