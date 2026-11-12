import type { Cell, Shape } from "./types.ts";

const TAU = Math.PI * 2;

function wrap(angle: number) {
  let value = angle;
  while (value > Math.PI) value -= TAU;
  while (value < -Math.PI) value += TAU;
  return value;
}

/** True only inside the published arc or rectangle. A surrounding circle is not a hit. */
export function shapeContains(shape: Shape, x: number, z: number): boolean {
  if (shape.kind === "arc") {
    const dx = x - shape.x;
    const dz = z - shape.z;
    const dist = Math.hypot(dx, dz);
    if (dist > shape.radius || dist < 1e-6) return false;
    return Math.abs(wrap(Math.atan2(dx, dz) - shape.facing)) <= shape.half;
  }
  const dx = x - shape.x;
  const dz = z - shape.z;
  const cos = Math.cos(shape.yaw);
  const sin = Math.sin(shape.yaw);
  const localX = dx * cos + dz * sin;
  const localZ = -dx * sin + dz * cos;
  return Math.abs(localX) <= shape.width / 2 && Math.abs(localZ) <= shape.length / 2;
}

export function damageInShape(shape: Shape, x: number, z: number, amount: number): number {
  return shapeContains(shape, x, z) ? amount : 0;
}

export function cellPoint(cell: Cell) {
  return { x: cell.x + 0.5, z: cell.y + 0.5 };
}

export function cellsInShape(shape: Shape, span = 5): Cell[] {
  const cells: Cell[] = [];
  for (let x = 0; x < span; x += 1) {
    for (let y = 0; y < span; y += 1) {
      if (shapeContains(shape, x + 0.5, y + 0.5)) cells.push({ x, y });
    }
  }
  return cells;
}

export function sameCell(a: Cell, b: Cell) {
  return a.x === b.x && a.y === b.y;
}

export function telegraphLabel(shape: Shape | null): string {
  if (!shape) return "沒有預警";
  return shape.kind === "arc" ? "扇形預警" : "長條預警";
}

/** The circle a misleading cone would still be tested against. Tests use this to prove we do not. */
export function circleContains(x: number, z: number, originX: number, originZ: number, radius: number) {
  return Math.hypot(x - originX, z - originZ) <= radius;
}
