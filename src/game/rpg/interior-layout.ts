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
  const y = 0.014;
  const lane = (sign: 1 | -1) => {
    const baseline = sign * halfX;
    const inward = sign * (halfX - laneDepth);
    const mid = sign * (halfX - laneDepth / 2);
    return [
      { position: [mid, y, laneHalfZ] as const, size: [laneDepth, 0.012, line] as const },
      { position: [mid, y, -laneHalfZ] as const, size: [laneDepth, 0.012, line] as const },
      { position: [inward, y, 0] as const, size: [line, 0.012, laneHalfZ * 2] as const },
      { position: [baseline, y, 0] as const, size: [line, 0.012, halfZ * 2] as const },
    ];
  };
  return [
    { position: [0, y, halfZ] as const, size: [halfX * 2, 0.012, line] as const },
    { position: [0, y, -halfZ] as const, size: [halfX * 2, 0.012, line] as const },
    ...lane(1),
    ...lane(-1),
  ];
}

/** The one set of floor paint for the gym. Replaces the older ±8.5 / ±5.5 court. */
export function gymFloorMarks() {
  const { halfX, line } = ACTIVITY_COURT;
  return [
    ...activityCourtSegments(),
    { position: [0, 0.02, 0] as const, size: [halfX * 2, 0.012, line] as const },
  ];
}

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

/** Where a body appears on entering or resuming an interior. The pool deck stays south of the water. */
export function interiorSpawn(id: string) {
  if (id === "swimming") return { x: 0, z: SWIMMING_POOL.halfZ + 1.2, yaw: 0 };
  return { x: 0, z: 4, yaw: 0 };
}

export function poolBlockPositions() {
  const { halfX, halfZ, lanes } = SWIMMING_POOL;
  const step = (halfZ * 2) / lanes;
  return Array.from({ length: lanes }, (_, i) => ({
    x: -halfX - 0.48,
    z: -halfZ + step * (i + 0.5),
  }));
}

/**
 * Black-swan plinth in the museum interior. The bird is an estimated
 * silhouette. The pad is wide enough that a dodge cannot step through it,
 * and its north face stays inside the room.
 */
export const MUSEUM_SWAN = { x: 0, z: -5.3, size: 1.4 };
