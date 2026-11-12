/**
 * Painted lines for the open courts. Sizes are estimated game markings,
 * not a measured court.
 */
export type CourtLine = {
  x: number;
  z: number;
  length: number;
  /** The line's long axis in the court's local frame. */
  axis: "x" | "z";
  net?: boolean;
};

function rectangle(cx: number, cz: number, w: number, d: number): CourtLine[] {
  return [
    { x: cx, z: cz - d / 2, length: w, axis: "x" },
    { x: cx, z: cz + d / 2, length: w, axis: "x" },
    { x: cx - w / 2, z: cz, length: d, axis: "z" },
    { x: cx + w / 2, z: cz, length: d, axis: "z" },
    { x: cx, z: cz, length: w, axis: "x", net: true },
  ];
}

export function courtMarkings(id: string, size: readonly [number, number, number]): CourtLine[] {
  if (id === "wuhu-courts") {
    const w = 16;
    const d = 30;
    const shift = (w + 6) / 2;
    if (shift + w / 2 > size[0] / 2 || d / 2 > size[2] / 2) return [];
    return [...rectangle(-shift, 0, w, d), ...rectangle(shift, 0, w, d)];
  }
  if (id === "volleyball-court") {
    const w = Math.min(9, size[0] - 4);
    const d = Math.min(18, size[2] - 4);
    if (w < 4 || d < 8) return [];
    return rectangle(0, 0, w, d);
  }
  return [];
}

export function lineInsideCourt(line: CourtLine, size: readonly [number, number, number]) {
  const hx = line.axis === "x" ? line.length / 2 : 0;
  const hz = line.axis === "z" ? line.length / 2 : 0;
  return (
    Math.abs(line.x) + hx <= size[0] / 2 &&
    Math.abs(line.z) + hz <= size[2] / 2
  );
}

/** Inner edge of the painted track ring, in metres. Matches the ring scale in the renderer. */
export function trackInnerAxes(size: readonly [number, number, number]) {
  return { x: size[0] * 0.46 * 0.76, z: size[2] * 0.46 * 0.76 };
}

/** A grass pitch inside the track oval. No net: the infield stays open. */
export function trackInfield(size: readonly [number, number, number]): CourtLine[] {
  const inner = trackInnerAxes(size);
  const margin = 3;
  const ax = inner.x - margin;
  const az = inner.z - margin;
  if (ax < 12 || az < 16) return [];
  const w = Math.min(24, ax * 1.4);
  const d = Math.min(40, az * 1.4);
  const corners: [number, number][] = [
    [w / 2, d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [-w / 2, -d / 2],
  ];
  if (corners.some(([x, z]) => (x / ax) ** 2 + (z / az) ** 2 > 1)) return [];
  return [
    { x: 0, z: -d / 2, length: w, axis: "x" },
    { x: 0, z: d / 2, length: w, axis: "x" },
    { x: -w / 2, z: 0, length: d, axis: "z" },
    { x: w / 2, z: 0, length: d, axis: "z" },
    { x: 0, z: 0, length: w, axis: "x" },
  ];
}

export function lineInsideTrackOval(line: CourtLine, size: readonly [number, number, number]) {
  const inner = trackInnerAxes(size);
  const hx = line.axis === "x" ? line.length / 2 : 0;
  const hz = line.axis === "z" ? line.length / 2 : 0;
  const samples: [number, number][] = [
    [line.x - hx, line.z - hz],
    [line.x + hx, line.z + hz],
    [line.x, line.z],
  ];
  return samples.every(([x, z]) => (x / inner.x) ** 2 + (z / inner.z) ** 2 < 1);
}
