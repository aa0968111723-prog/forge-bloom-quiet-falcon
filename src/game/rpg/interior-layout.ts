export const ROOM_TABLE_SIZE = { width: 1.8, depth: 1.1 };

export const ROOM_TABLES = [-6, -3, 3, 6].flatMap((x) =>
  [-3, 1].map((z) => ({ x, z })),
);

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
