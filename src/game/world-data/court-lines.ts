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
