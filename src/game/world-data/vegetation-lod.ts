/** Split plants by horizontal distance. Inside `range` is the detailed set. */
export function splitPlants<T extends { x: number; z: number }>(
  plants: readonly T[],
  x: number,
  z: number,
  range: number,
): { near: T[]; far: T[] } {
  const near: T[] = [];
  const far: T[] = [];
  for (const plant of plants) {
    (Math.hypot(plant.x - x, plant.z - z) < range ? near : far).push(plant);
  }
  return { near, far };
}
