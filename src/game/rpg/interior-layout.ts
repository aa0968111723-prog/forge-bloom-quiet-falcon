export const ROOM_TABLE_SIZE = { width: 1.8, depth: 1.1 };

export const ROOM_TABLES = [-6, -3, 3, 6].flatMap((x) =>
  [-3, 1].map((z) => ({ x, z })),
);

/** Front desk in the palace classroom, clear of the student tables and the south door. */
export const CLASSROOM_DESK = { x: 0, z: -5.51, width: 1.6, depth: 1.3 } as const;
