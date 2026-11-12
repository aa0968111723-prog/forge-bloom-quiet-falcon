export const ROOM_TABLE_SIZE = { width: 1.8, depth: 1.1 };

export const ROOM_TABLES = [-6, -3, 3, 6].flatMap((x) =>
  [-3, 1].map((z) => ({ x, z })),
);

/** Two carrels along the north wall of the reading room. The centre aisle stays open. */
export const READING_CARRELS = [
  { x: -4.5, z: -5.4, width: 1.4, depth: 1.3 },
  { x: 4.5, z: -5.4, width: 1.4, depth: 1.3 },
] as const;
