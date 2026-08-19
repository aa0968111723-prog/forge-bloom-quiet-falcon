/**
 * Lighting / atmosphere presets, recalibrated for the real-scale campus.
 *
 * Reality Pass v1 goal: 淡水 weather, not a fantasy film. Concretely that means
 *  - exposure sits where a phone photo would sit; nothing blooms out
 *  - the sun comes from a direction consistent with the time of day, and the
 *    sunset sun is west (-X), across the river, because that is the view the
 *    avenue is famous for
 *  - the overcast preset is genuinely flat and slightly cool; Tamsui winters are
 *    grey, and a scene that is always sunny reads as fake to anybody who has
 *    walked 宮燈大道 in February (REF_TAMSUI_WEATHER)
 *  - fog is used for aerial perspective over ~300 m of campus, not as a mood
 *    filter 30 m from the camera
 *  - `wetness` darkens albedo and drops roughness in the material layer instead
 *    of being faked with a shiny overlay
 */
export type TimeOfDay = "day" | "cloudy" | "sunset" | "night" | "wet";

export const TIME_OF_DAY_VALUES: readonly TimeOfDay[] = ["day", "cloudy", "sunset", "night", "wet"];

export type LightingPreset = {
  label: string;
  sun: string;
  sky: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sunIntensity: number;
  hemiIntensity: number;
  ambientIntensity: number;
  sunPos: [number, number, number];
  fogNear: number;
  fogFar: number;
  /** Renderer tone-mapping exposure. */
  exposure: number;
  /** Shadow darkness/softness hint: 0 disables sun shadows entirely. */
  shadowStrength: number;
  /** 0 = dry, 1 = soaked. Drives material roughness/albedo. */
  wetness: number;
  /** Lanterns and window emission on. */
  lampsOn: boolean;
  /** Visible sun/moon disc, if any. */
  disc?: { position: [number, number, number]; radius: number; color: string };
};

export const TIME_PRESETS: Record<TimeOfDay, LightingPreset> = {
  day: {
    label: "晴天",
    sun: "#fff4e0",
    sky: "#87bede",
    fog: "#bed3e0",
    hemiSky: "#d5e8f5",
    hemiGround: "#9d9a8a",
    sunIntensity: 2.5,
    hemiIntensity: 0.55,
    ambientIntensity: 0.12,
    sunPos: [150, 210, 120],
    fogNear: 180,
    fogFar: 760,
    exposure: 1.0,
    shadowStrength: 1,
    wetness: 0,
    lampsOn: false,
    disc: { position: [170, 240, 140], radius: 9, color: "#fff8e2" },
  },
  cloudy: {
    label: "淡水陰天",
    sun: "#dfe6ec",
    sky: "#b9c3cb",
    fog: "#c2cbd2",
    hemiSky: "#cfd8de",
    hemiGround: "#8f8b7e",
    // Overcast: almost all the light arrives from the sky dome, so the
    // directional light is weak and the hemisphere carries the scene.
    sunIntensity: 0.55,
    hemiIntensity: 1.35,
    ambientIntensity: 0.3,
    sunPos: [90, 240, 60],
    fogNear: 90,
    fogFar: 460,
    exposure: 0.98,
    shadowStrength: 0.25,
    wetness: 0.2,
    lampsOn: false,
  },
  sunset: {
    label: "宮燈夕照",
    sun: "#ffb271",
    sky: "#e2a273",
    fog: "#dfa87d",
    hemiSky: "#ffcda6",
    hemiGround: "#6f513c",
    sunIntensity: 2.1,
    hemiIntensity: 0.45,
    ambientIntensity: 0.1,
    // Low and due west, over the Tamsui River.
    sunPos: [-320, 46, 40],
    fogNear: 120,
    fogFar: 620,
    exposure: 1.02,
    shadowStrength: 1,
    wetness: 0,
    lampsOn: true,
    disc: { position: [-330, 40, 46], radius: 14, color: "#ffcf9c" },
  },
  night: {
    label: "夜訪",
    sun: "#8ea4c4",
    sky: "#0a1120",
    fog: "#0b1320",
    hemiSky: "#18243c",
    hemiGround: "#0a0c12",
    sunIntensity: 0.16,
    hemiIntensity: 0.2,
    ambientIntensity: 0.05,
    sunPos: [120, 190, -160],
    fogNear: 40,
    fogFar: 300,
    exposure: 1.08,
    shadowStrength: 0.35,
    wetness: 0.1,
    lampsOn: true,
    disc: { position: [130, 200, -170], radius: 6, color: "#e6ecf4" },
  },
  wet: {
    label: "雨後",
    sun: "#ccd6dd",
    sky: "#a8b2ba",
    fog: "#b0bac1",
    hemiSky: "#c3ccd3",
    hemiGround: "#6d6a60",
    sunIntensity: 0.45,
    hemiIntensity: 1.2,
    ambientIntensity: 0.28,
    sunPos: [70, 230, 90],
    fogNear: 60,
    fogFar: 360,
    exposure: 0.95,
    shadowStrength: 0.2,
    wetness: 1,
    lampsOn: true,
  },
};

/** Legacy save files only ever stored day / sunset / night. */
export function coerceTimeOfDay(value: unknown): TimeOfDay | null {
  return typeof value === "string" && (TIME_OF_DAY_VALUES as readonly string[]).includes(value)
    ? (value as TimeOfDay)
    : null;
}
