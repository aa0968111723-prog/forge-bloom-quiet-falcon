export const ROOM_TABLE_SIZE = { width: 1.8, depth: 1.1 };

export const ROOM_TABLES = [-6, -3, 3, 6].flatMap((x) =>
  [-3, 1].map((z) => ({ x, z })),
);

/**
 * Reading-room shelves sit in the strip between the body and the wall.
 * The room stops a 0.42 m body at x = ±9, so the body edge is 9.
 * The side wall's inner face is 9.45.
 */
export const LIBRARY_SHELF = {
  bookX: 9.29,
  bookDepth: 0.22,
  boardX: 9.24,
  boardDepth: 0.36,
  bodyEdge: 9,
  wallInner: 9.45,
} as const;
