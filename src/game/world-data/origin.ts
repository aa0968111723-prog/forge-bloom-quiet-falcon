/**
 * Tamkang World Coordinate System (TWCS)
 * ======================================
 *
 * One Three.js world unit is exactly one metre. Everything in `world-data/`
 * is expressed in metres and shares this single origin, so landmark spacing
 * can be checked against reality instead of being eyeballed per building.
 *
 * Axes
 * ----
 *   +X  -> real EAST      (inland, towards 五虎崗 ridge / 商管大樓)
 *   -X  -> real WEST      (towards the Tamsui River and 觀音山)
 *   -Z  -> real NORTH     (down 宮燈大道 towards 海豚里程碑 / 圖書館)
 *   +Z  -> real SOUTH     (towards 克難坡 bottom entrance / 水源街)
 *   +Y  -> UP (elevation)
 *
 * The -Z = north convention is inherited from the pre-Reality-Pass scene so
 * saves, minimap and the QA harness keep the same handedness; only the scale
 * changed.
 *
 * Origin
 * ------
 * World (0, ?, 0) is the centre of 驚聲銅像廣場 (Chingsheng bronze statue
 * plaza) at the top of 克難坡. It was chosen because it is the junction of the
 * two v1 benchmarks (the slope and the avenue) and is a small, unambiguous,
 * physically fixed point.
 *
 * Elevation datum
 * ---------------
 * y = 0 is the paved apron at the *bottom* entrance of 克難坡. Everything on
 * the campus plateau is therefore a positive height above the slope foot. This
 * datum is local: it is NOT metres above sea level, and no claim about
 * absolute altitude is made anywhere in this layer.
 */

/** Accuracy of a piece of reality data. Never claim more than you can source. */
export type Accuracy =
  /** Measured on site (tape/laser/level) or taken from a published survey drawing. */
  | "surveyed"
  /** Read off a map, plan, satellite image or a documented published figure. */
  | "mapped"
  /** Reconstructed from typical construction dimensions + photographs. Re-calibrate later. */
  | "estimated";

export const ACCURACY_VALUES: readonly Accuracy[] = ["surveyed", "mapped", "estimated"];

/** 1 world unit = 1 metre. Kept as a named constant so conversions stay explicit. */
export const METERS_PER_UNIT = 1;

/** Direction of real north in world space (unit vector on the XZ plane). */
export const NORTH_VECTOR: readonly [number, number] = [0, -1];
/** Direction of real east in world space (unit vector on the XZ plane). */
export const EAST_VECTOR: readonly [number, number] = [1, 0];

/**
 * Compass bearing (degrees clockwise from true north) of the game's -Z axis.
 *
 * 0 means "the 宮燈大道 axis is modelled as running due north". The real avenue
 * is not exactly north-aligned; until the axis is surveyed this stays 0 and the
 * whole campus is treated as axis-aligned, which is why every angle-derived
 * figure below is tagged `estimated`.
 */
export const AXIS_BEARING_DEG = 0;
export const AXIS_BEARING_ACCURACY: Accuracy = "estimated";

/**
 * Geographic anchor of the world origin.
 *
 * Approximate position of the Tamkang University Tamsui campus core. Used only
 * for metadata / future GIS calibration — no gameplay depends on it, and it is
 * deliberately tagged `estimated` rather than presented as a survey point.
 */
export const ORIGIN_REAL_COORDINATE = { lat: 25.1747, lng: 121.449 };
export const ORIGIN_REAL_COORDINATE_ACCURACY: Accuracy = "estimated";

/** Metres per degree at the origin latitude (spherical approximation). */
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LNG = 111320 * Math.cos((ORIGIN_REAL_COORDINATE.lat * Math.PI) / 180);

export type RealCoordinate = { lat: number; lng: number };

/**
 * Local ENU projection of a WGS84 coordinate into world XZ metres.
 *
 * Accurate to well under a metre across the ~600 m of campus this scene covers,
 * which is far below the accuracy of the input data itself.
 */
export function realToWorld(coord: RealCoordinate): [number, number] {
  const east = (coord.lng - ORIGIN_REAL_COORDINATE.lng) * M_PER_DEG_LNG;
  const north = (coord.lat - ORIGIN_REAL_COORDINATE.lat) * M_PER_DEG_LAT;
  const rad = (AXIS_BEARING_DEG * Math.PI) / 180;
  // Rotate real ENU into world axes, then map north onto -Z.
  const x = east * Math.cos(rad) - north * Math.sin(rad);
  const zNorth = north * Math.cos(rad) + east * Math.sin(rad);
  return [x, -zNorth];
}

/** Inverse of {@link realToWorld}. */
export function worldToReal(x: number, z: number): RealCoordinate {
  const rad = (AXIS_BEARING_DEG * Math.PI) / 180;
  const zNorth = -z;
  // Transpose of the rotation applied in realToWorld.
  const east = x * Math.cos(rad) + zNorth * Math.sin(rad);
  const north = zNorth * Math.cos(rad) - x * Math.sin(rad);
  return {
    lat: ORIGIN_REAL_COORDINATE.lat + north / M_PER_DEG_LAT,
    lng: ORIGIN_REAL_COORDINATE.lng + east / M_PER_DEG_LNG,
  };
}

/** Compass bearing (deg from true north) of a world-space XZ direction. */
export function worldBearingDeg(dx: number, dz: number): number {
  const deg = (Math.atan2(dx, -dz) * 180) / Math.PI + AXIS_BEARING_DEG;
  return ((deg % 360) + 360) % 360;
}

/**
 * Playable extent. The v1 reality corridor runs roughly z = +90 (slope foot)
 * to z = -350 (behind the library); the surround exists for silhouette only.
 */
export const WORLD_BOUNDS = {
  minX: -230,
  maxX: 205,
  minZ: -365,
  maxZ: 110,
} as const;

export const WORLD_SIZE = {
  width: WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX,
  depth: WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ,
} as const;
