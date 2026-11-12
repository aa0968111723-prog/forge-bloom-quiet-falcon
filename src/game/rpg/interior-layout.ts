export const ROOM_TABLE_SIZE = { width: 1.8, depth: 1.1 };

export const ROOM_TABLES = [-6, -3, 3, 6].flatMap((x) =>
  [-3, 1].map((z) => ({ x, z })),
);

/** Floor plates under the activity-room baskets. Wide enough that one dodge stays on the near side. */
export const HOOP_STANDS = [
  { x: -8, z: 0, size: 1.4 },
  { x: 8, z: 0, size: 1.4 },
] as const;

/** Front desk in the palace classroom, clear of the student tables and the south door. */
export const CLASSROOM_DESK = { x: 0, z: -5.51, width: 1.6, depth: 1.3 } as const;

/** Two carrels along the north wall of the reading room. The centre aisle stays open. */
export const READING_CARRELS = [
  { x: -4.5, z: -5.4, width: 1.4, depth: 1.3 },
  { x: 4.5, z: -5.4, width: 1.4, depth: 1.3 },
] as const;

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

/**
 * Painted marks on the activity-room floor. The hoops stand at x=±8 and the
 * rims sit 0.5 m toward centre, so the baselines stay between the rim and the
 * pole. Lines are flat paint and do not collide.
 */
export const ACTIVITY_COURT = {
  halfX: 7.7,
  halfZ: 5.2,
  line: 0.08,
  laneDepth: 2.4,
  laneHalfZ: 1.2,
  rimX: 7.5,
  poleX: 8,
};

export function activityCourtSegments() {
  const { halfX, halfZ, line, laneDepth, laneHalfZ } = ACTIVITY_COURT;
  const y = 0.04;
  const lane = (sign: 1 | -1) => {
    const baseline = sign * halfX;
    const inward = sign * (halfX - laneDepth);
    const mid = sign * (halfX - laneDepth / 2);
    return [
      { position: [mid, y, laneHalfZ] as const, size: [laneDepth, 0.01, line] as const },
      { position: [mid, y, -laneHalfZ] as const, size: [laneDepth, 0.01, line] as const },
      { position: [inward, y, 0] as const, size: [line, 0.01, laneHalfZ * 2] as const },
      { position: [baseline, y, 0] as const, size: [line, 0.01, halfZ * 2] as const },
    ];
  };
  return [
    { position: [0, y, halfZ] as const, size: [halfX * 2, 0.01, line] as const },
    { position: [0, y, -halfZ] as const, size: [halfX * 2, 0.01, line] as const },
    ...lane(1),
    ...lane(-1),
  ];
}
