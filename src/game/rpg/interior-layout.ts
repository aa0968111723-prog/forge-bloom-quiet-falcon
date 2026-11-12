export const ROOM_TABLE_SIZE = { width: 1.8, depth: 1.1 };

export const ROOM_TABLES = [-6, -3, 3, 6].flatMap((x) =>
  [-3, 1].map((z) => ({ x, z })),
);

/**
 * Water in the swimming-hall interior. The basin blocks a walking body.
 * Lane marks and the starting blocks sit on top and do not add colliders.
 * Length is estimated.
 */
export const SWIMMING_POOL = {
  halfX: 6.2,
  halfZ: 4,
  lanes: 6,
};

export function poolLaneOffsets() {
  const { halfZ, lanes } = SWIMMING_POOL;
  const step = (halfZ * 2) / lanes;
  return Array.from({ length: lanes - 1 }, (_, i) => -halfZ + step * (i + 1));
}

export function poolBlockPositions() {
  const { halfX, halfZ, lanes } = SWIMMING_POOL;
  const step = (halfZ * 2) / lanes;
  return Array.from({ length: lanes }, (_, i) => ({
    x: -halfX - 0.48,
    z: -halfZ + step * (i + 0.5),
  }));
}
