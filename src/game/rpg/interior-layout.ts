export const ROOM_TABLE_SIZE = { width: 1.8, depth: 1.1 };

export const ROOM_TABLES = [-6, -3, 3, 6].flatMap((x) =>
  [-3, 1].map((z) => ({ x, z })),
);

/** Floor plates under the activity-room baskets. Wide enough that one dodge stays on the near side. */
export const HOOP_STANDS = [
  { x: -8, z: 0, size: 1.4 },
  { x: 8, z: 0, size: 1.4 },
] as const;
