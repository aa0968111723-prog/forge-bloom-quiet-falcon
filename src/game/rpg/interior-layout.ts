export const ROOM_TABLE_SIZE = { width: 1.8, depth: 1.1 };

export const ROOM_TABLES = [-6, -3, 3, 6].flatMap((x) =>
  [-3, 1].map((z) => ({ x, z })),
);

/**
 * Black-swan plinth in the museum interior. The bird is an estimated
 * silhouette. The pad is wide enough that a dodge cannot step through it,
 * and its north face stays inside the room.
 */
export const MUSEUM_SWAN = { x: 0, z: -5.3, size: 1.4 };
