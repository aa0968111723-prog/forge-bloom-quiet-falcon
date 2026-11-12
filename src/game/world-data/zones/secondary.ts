import { AXIS } from "../axis.ts";
import { CAMPUS_SITES } from "../../rpg/campus.ts";
import { sampleGroundElevation } from "../elevation.ts";
import type { Accuracy } from "../origin.ts";

/**
 * Structures outside the Reality Pass v1 corridor.
 *
 * Pre-v1 silhouettes were re-seated onto real-scale ground. East academic and
 * west academic clusters are now named walkable buildings with colliders;
 * positions stay `estimated` (REF_SECONDARY_ZONE_PLACEHOLDER).
 */
export type CampusCluster = "east" | "west-academic" | "north";

export type SecondaryStructure = {
  id: string;
  name: string;
  nameEn: string;
  /** Centre in world XZ. */
  position: [number, number];
  /** width (X) × height (Y) × depth (Z), metres. */
  size: [number, number, number];
  rotationY: number;
  floors?: number;
  kind:
    | "hip-roof-block"
    | "slab-block"
    | "hall"
    | "pavilion"
    | "court"
    | "ship"
    | "gate"
    | "white-block"
    | "dorm-block"
    | "lab-block"
    | "sport-hall"
    | "study-block"
    | "linked-hall"
    | "forum-hall"
    | "stand"
    | "shed"
    | "intl-dorm"
    | "media-hall"
    | "auditorium"
    | "studio-block"
    | "activity-hall"
    | "watch-post"
    | "eng-tower"
    | "memorial-tower"
    | "arena"
    | "science-hall"
    | "workshop"
    | "pool-hall"
    | "office-block"
    | "faculty-house"
    | "garden-house"
    | "language-hall"
    | "chem-hall";
  cluster: CampusCluster;
  /** Player can walk up to a door approach; solid kinds also have colliders. */
  walkable: boolean;
  accuracy: Accuracy;
  referenceIds: string[];
};

const REF = ["REF_SECONDARY_ZONE_PLACEHOLDER"];

const LEGACY_SECONDARY_STRUCTURES: SecondaryStructure[] = [
  {
    id: "chingsheng-building",
    name: "驚聲大樓",
    nameEn: "Ching-sheng Building",
    position: [-52, AXIS.scrollPlazaZ - 4],
    size: [30, 30, 24],
    rotationY: 0,
    floors: 8,
    kind: "memorial-tower",
    cluster: "west-academic",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "business-building",
    name: "商管大樓",
    nameEn: "Business Building",
    position: [118, -182],
    size: [34, 30, 22],
    rotationY: 0.1,
    floors: 8,
    kind: "study-block",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "gymnasium",
    name: "紹謨紀念體育館",
    nameEn: "Shao-mo Memorial Gymnasium",
    position: [166, -122],
    size: [44, 16, 30],
    rotationY: 0,
    kind: "arena",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "maritime-museum",
    name: "海事博物館",
    nameEn: "Maritime Museum",
    position: [150, -252],
    size: [46, 16, 20],
    rotationY: 0.16,
    kind: "ship",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "juexuan-garden",
    name: "覺軒花園",
    nameEn: "Jue-xuan Garden",
    position: [-46, -108],
    size: [22, 6, 16],
    rotationY: 0,
    kind: "pavilion",
    cluster: "west-academic",
    walkable: true,
    accuracy: "estimated",
    referenceIds: ["REF_PALACE_CLASSROOMS_1954", ...REF],
  },
  {
    id: "volleyball-court",
    name: "排球場",
    nameEn: "Volleyball Court",
    position: [72, -150],
    size: [18, 0, 32],
    rotationY: 0,
    kind: "court",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "engineering-hall",
    name: "工學大樓",
    nameEn: "Engineering Building",
    position: [100, -90],
    size: [30, 28, 18],
    rotationY: 0,
    floors: 7,
    kind: "slab-block",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "science-hall",
    name: "科學館",
    nameEn: "Science Building",
    position: [112, -40],
    size: [26, 24, 16],
    rotationY: 0,
    floors: 6,
    kind: "slab-block",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "liberal-arts-hall",
    name: "文學館",
    nameEn: "Liberal Arts Building",
    position: [98, 8],
    size: [24, 22, 16],
    rotationY: 0,
    floors: 5,
    kind: "hip-roof-block",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "foreign-lang-hall",
    name: "外語大樓",
    nameEn: "Foreign Languages Building",
    position: [138, -40],
    size: [26, 22, 16],
    rotationY: 0,
    floors: 5,
    kind: "hip-roof-block",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "education-hall",
    name: "教育館",
    nameEn: "Education Building",
    position: [180, -70],
    size: [24, 20, 16],
    rotationY: 0,
    floors: 5,
    kind: "slab-block",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "ai-center",
    name: "AI創智中心",
    nameEn: "AI Innovation Center",
    position: [180, -190],
    size: [26, 18, 18],
    rotationY: 0,
    floors: 4,
    kind: "slab-block",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "health-hall",
    name: "精準健康館",
    nameEn: "Precision Healthcare Hall",
    position: [180, -230],
    size: [24, 16, 16],
    rotationY: 0,
    floors: 4,
    kind: "slab-block",
    cluster: "east",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "student-center",
    name: "學生活動中心",
    nameEn: "Student Activity Center",
    position: [-88, -48],
    size: [28, 14, 18],
    rotationY: 0,
    floors: 3,
    kind: "hall",
    cluster: "west-academic",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "admin-hall",
    name: "行政大樓",
    nameEn: "Administration Building",
    position: [-94, 18],
    size: [26, 22, 18],
    rotationY: 0,
    floors: 6,
    kind: "slab-block",
    cluster: "west-academic",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "research-hall",
    name: "研究大樓",
    nameEn: "Research Building",
    position: [-86, -160],
    size: [24, 26, 16],
    rotationY: 0,
    floors: 7,
    kind: "slab-block",
    cluster: "west-academic",
    walkable: true,
    accuracy: "estimated",
    referenceIds: REF,
  },
];

/** Named buildings the player can walk up to (excludes open courts). */
export function namedWalkableBuildings(): SecondaryStructure[] {
  return SECONDARY_STRUCTURES.filter((s) => s.walkable && s.kind !== "court");
}

/** Door approach on the south face, a few metres off the wall. */
export function buildingApproachPoint(s: SecondaryStructure): { x: number; z: number } {
  return { x: s.position[0], z: s.position[1] + s.size[2] / 2 + 3.4 };
}

/** Side piers of a guard gate. The span between them stays walkable. */
export const GATE_PIER_WIDTH = 1.5;

export const PAVILION_POST = 0.55;
export const PAVILION_INSET = 1.15;

/** Corner posts of 覺軒花園. The span between them stays walkable. */
export function pavilionPosts(s: Pick<SecondaryStructure, "position" | "size">) {
  const hx = s.size[0] / 2 - PAVILION_INSET;
  const hz = s.size[2] / 2 - PAVILION_INSET;
  const posts = [];
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      posts.push({
        x: s.position[0] + sx * hx,
        z: s.position[1] + sz * hz,
        w: PAVILION_POST,
        d: PAVILION_POST,
      });
    }
  }
  return posts;
}

export function gatePiers(s: Pick<SecondaryStructure, "position" | "size">) {
  const pier = GATE_PIER_WIDTH;
  const offset = (s.size[0] - pier) / 2;
  return [-1, 1].map((side) => ({
    x: s.position[0] + side * offset,
    z: s.position[1],
    w: pier,
    d: s.size[2],
  }));
}

/** Window bands, names, and roof caps drop off past this distance. The mass stays. */
export function contextDetailLimit(tier: "high" | "low") {
  return tier === "low" ? 48 : 90;
}

export function contextShowsDetail(
  cameraX: number,
  cameraZ: number,
  x: number,
  z: number,
  tier: "high" | "low",
) {
  return Math.hypot(cameraX - x, cameraZ - z) <= contextDetailLimit(tier);
}

/**
 * Concrete studio used by 建築系館. The south glass, canopy, and roof monitor
 * are an estimated silhouette, not a measured facade.
 */
export function studioProfile(size: readonly [number, number, number]) {
  return {
    glassH: Math.max(3.2, size[1] * 0.7),
    glassZ: size[2] / 2 + 0.08,
    glassW: size[0] * 0.78,
    canopyY: Math.min(3.6, size[1] * 0.24),
    canopyDepth: 2.4,
    monitorW: size[0] * 0.42,
    monitorH: 2.2,
    monitorD: Math.max(3.2, size[2] * 0.34),
    monitorZ: size[2] * 0.12,
  };
}

/**
 * Chemistry hall for 鍾靈化學館. The south glass and roof stack are an
 * estimated silhouette. The science hall keeps its glass bay, and the
 * workshop keeps its brick base.
 */
export function chemHallProfile(size: readonly [number, number, number]) {
  const stackW = Math.min(3.2, size[0] * 0.12);
  const stackD = Math.min(3.2, size[2] * 0.14);
  const glassH = Math.min(1.1, size[1] * 0.08);
  return {
    baseH: Math.min(1.8, Math.max(1.2, size[1] * 0.12)),
    glassZ: size[2] / 2 + 0.08,
    glassH,
    glassW: size[0] * 0.62,
    glassY: size[1] * 0.55,
    stackW,
    stackD,
    stackH: Math.min(2.8, Math.max(1.8, size[1] * 0.16)),
    stackX: size[0] * 0.28,
    stackZ: -size[2] * 0.12,
  };
}

/**
 * Older workshop hall for 工學館. The brick base and roof monitor are estimated.
 * The engineering tower stays a set-back tower.
 */
export function workshopProfile(size: readonly [number, number, number]) {
  const baseH = Math.max(3.2, size[1] * 0.3);
  return {
    baseH,
    glassZ: size[2] / 2 + 0.08,
    glassW: size[0] * 0.42,
    monitorW: size[0] * 0.26,
    monitorH: 1.5,
    monitorD: Math.max(3, size[2] * 0.22),
  };
}

/**
 * Student-activity mass for 學生活動中心. The lobby, canopy, and set-back
 * upper floors are an estimated silhouette, not a measured facade.
 */
export function activityProfile(size: readonly [number, number, number]) {
  const lobbyH = Math.min(4.2, Math.max(3.2, size[1] * 0.28));
  return {
    lobbyH,
    glassZ: size[2] / 2 + 0.08,
    glassW: size[0] * 0.68,
    canopyDepth: 2.6,
    upperW: size[0] - 2.4,
    upperD: size[2] - 1.8,
  };
}

/**
 * Low control booth for 勤務監控管制中心. The window and mast are an
 * estimated silhouette, not a measured hut.
 */
export function watchPostProfile(size: readonly [number, number, number]) {
  return {
    glassZ: size[2] / 2 + 0.06,
    glassH: Math.min(1.6, size[1] * 0.42),
    glassW: Math.max(2.4, size[0] * 0.55),
    mastH: 2.4,
    mastX: size[0] * 0.32,
  };
}

/**
 * Long pool hall for 紹謨紀念游泳館. The plinth, clerestory and roof spine
 * are an estimated silhouette, not a measured elevation.
 */
export function poolHallProfile(size: readonly [number, number, number]) {
  const baseH = Math.min(1.5, Math.max(1.05, size[1] * 0.16));
  const glassH = Math.min(0.9, size[1] * 0.12);
  const spineH = Math.min(1.2, Math.max(0.7, size[1] * 0.14));
  const spineD = size[2] * 0.34;
  return {
    baseH,
    glassZ: size[2] / 2 + 0.08,
    glassH,
    glassW: size[0] * 0.7,
    glassY: size[1] - glassH / 2 - 0.28,
    spineH,
    spineW: size[0] * 0.62,
    spineD,
    spineZ: size[2] * 0.1,
  };
}

/**
 * Podium and set-back tower for 工學大樓. The step-back is an estimated
 * silhouette, not a measured elevation.
 */
export function engTowerProfile(size: readonly [number, number, number]) {
  const podiumH = Math.max(3.4, size[1] * 0.22);
  const towerD = size[2] - 4;
  const towerZ = -0.8;
  return {
    podiumH,
    towerW: size[0] - 6,
    towerD,
    towerZ,
    glassZ: towerZ + towerD / 2 + 0.08,
  };
}

/**
 * Formal office block for 行政大樓. The entrance bay is an estimated
 * silhouette, not a measured elevation. Classroom halls stay study blocks.
 */
export function officeProfile(size: readonly [number, number, number]) {
  const bayH = Math.min(4.2, Math.max(3.2, size[1] * 0.22));
  return {
    bayW: Math.min(6.2, size[0] * 0.2),
    bayH,
    bayZ: size[2] / 2 + 0.08,
    bandW: size[0] * 0.72,
    bandH: 0.5,
  };
}

/**
 * Faculty house for 實棟學人宿舍. The porch is an estimated silhouette, not a
 * measured elevation. The Sungtao halls stay student dorms.
 */
export function facultyHouseProfile(size: readonly [number, number, number]) {
  const porchH = Math.min(3.2, Math.max(2.6, size[1] * 0.16));
  const porchD = 1.4;
  return {
    porchW: Math.min(8, size[0] * 0.28),
    porchH,
    porchD,
    porchZ: size[2] / 2 + porchD / 2,
    glassZ: size[2] / 2 + 0.08,
    glassW: Math.min(3.2, size[0] * 0.12),
    glassH: Math.min(2.4, porchH - 0.6),
  };
}

/**
 * Stone shaft for 驚聲大樓. The base and parapet are an estimated silhouette,
 * not a measured elevation. There is no tiled roof.
 */
export function memorialProfile(size: readonly [number, number, number]) {
  const baseH = Math.min(4.2, Math.max(3.2, size[1] * 0.14));
  return {
    baseH,
    glassZ: size[2] / 2 + 0.08,
    glassW: size[0] * 0.46,
  };
}

/**
 * Garden house for 濯纓苑／校史館. The veranda and hip roof are an estimated
 * silhouette, not a measured elevation. 文學館 and 覺軒 stay academic hip roofs.
 */
export function gardenHouseProfile(size: readonly [number, number, number]) {
  const porchD = 1.6;
  const porchH = Math.min(2.6, Math.max(2.2, size[1] * 0.34));
  const baseH = 1.4;
  const bodyH = Math.max(0, size[1] - baseH);
  return {
    baseH,
    bodyH,
    wallY: baseH + bodyH / 2,
    roofH: Math.min(2.2, Math.max(1.5, size[1] * 0.28)),
    roofR: Math.min(size[0], size[2]) * 0.62,
    porchW: Math.min(12, size[0] * 0.42),
    porchD,
    porchH,
    porchZ: size[2] / 2 + porchD / 2,
    glassZ: size[2] / 2 + 0.08,
    glassW: Math.min(4.4, size[0] * 0.18),
    glassH: Math.min(2.2, porchH - 0.5),
  };
}

/**
 * Sports hall for 紹謨紀念體育館. The plinth and clerestory are an estimated
 * silhouette, not a measured elevation. The pool stays a separate sport block.
 */
export function arenaProfile(size: readonly [number, number, number]) {
  return {
    baseH: Math.min(2.2, Math.max(1.4, size[1] * 0.14)),
    clerestoryY: size[1] - Math.max(2.2, size[1] * 0.18),
    glassZ: size[2] / 2 + 0.08,
    glassH: Math.max(1.4, size[1] * 0.12),
  };
}

/**
 * Teaching hall for 外國語文大樓. The ground gallery and south set-back are
 * an estimated silhouette. 教育館 and 會文館 stay classroom blocks. The older
 * foreign-lang-hall record stays separate.
 */
export function languageHallProfile(size: readonly [number, number, number]) {
  const galleryH = Math.min(3.6, Math.max(3, size[1] * 0.18));
  const upperD = size[2] - 2.2;
  const upperZ = -0.7;
  return {
    galleryH,
    galleryW: size[0] * 0.72,
    galleryZ: size[2] / 2 + 0.08,
    upperD,
    upperZ,
    upperSouth: upperZ + upperD / 2,
  };
}

/**
 * Named science hall for 騮先紀念科學館. The south glass bay is an estimated
 * silhouette. Chemistry keeps the lab block and its roof plant.
 */
export function scienceHallProfile(size: readonly [number, number, number]) {
  const bayW = Math.min(4.4, size[0] * 0.16);
  return {
    bayW,
    bayX: size[0] / 2 - bayW / 2 - 1.4,
    glassZ: size[2] / 2 + 0.08,
  };
}

/** Glass base plus the set-back upper volume used by 覺生綜合大樓. */
export function linkedHallProfile(size: readonly [number, number, number]) {
  const baseH = Math.max(3.2, size[1] * 0.42);
  return {
    baseH,
    upperWidth: size[0] - 2.4,
    upperDepth: size[2] - 2.2,
    upperZ: -0.6,
  };
}

/**
 * Local Z and width of one window band. The linked hall's upper floors sit
 * on the recessed volume, so those bands cannot use the full footprint.
 */
export function glazingBand(
  kind: SecondaryStructure["kind"],
  size: readonly [number, number, number],
  floors: number,
  floor: number,
  side: 1 | -1,
) {
  const full = { lz: side * (size[2] / 2 + 0.05), width: size[0] - 3 };
  if (kind !== "linked-hall") return full;
  const profile = linkedHallProfile(size);
  const y = ((floor + 0.55) * size[1]) / floors;
  if (y < profile.baseH) return full;
  return {
    lz: profile.upperZ + side * (profile.upperDepth / 2 + 0.05),
    width: Math.max(2, profile.upperWidth - 1.2),
  };
}

function campusKind(site: {
  id: string;
  form?: "court" | "gate";
  theme?: "study" | "lab" | "arts" | "sport" | "dorm";
}): SecondaryStructure["kind"] {
  if (site.form === "court") return "court";
  if (site.form === "gate") return "gate";
  if (site.id === "white-hall") return "white-block";
  if (site.id === "integrated") return "linked-hall";
  if (site.id === "conference") return "forum-hall";
  if (site.id === "reviewing") return "stand";
  if (site.id === "wind-lab") return "shed";
  if (site.id === "reitaku") return "intl-dorm";
  if (site.id === "business-o" || site.id === "business-q") return "media-hall";
  if (site.id === "audiovisual") return "auditorium";
  if (site.id === "architecture") return "studio-block";
  if (site.id === "commons") return "activity-hall";
  if (site.id === "security") return "watch-post";
  if (site.id === "engineering") return "eng-tower";
  if (site.id === "science") return "science-hall";
  if (site.id === "old-engineering") return "workshop";
  if (site.id === "swimming") return "pool-hall";
  if (site.id === "administration") return "office-block";
  if (site.id === "faculty") return "faculty-house";
  if (site.id === "yingyuan") return "garden-house";
  if (site.id === "foreign") return "language-hall";
  if (site.id === "chemistry") return "chem-hall";
  if (site.theme === "arts") return "hip-roof-block";
  if (site.theme === "dorm") return "dorm-block";
  if (site.theme === "lab") return "lab-block";
  if (site.theme === "sport") return "sport-hall";
  if (site.theme === "study") return "study-block";
  return "slab-block";
}

export const SECONDARY_STRUCTURES: SecondaryStructure[] = [
  ...LEGACY_SECONDARY_STRUCTURES.slice(0, 6),
  ...CAMPUS_SITES.filter((s) => !s.existing).map((s): SecondaryStructure => ({
    id: s.id, name: s.name, nameEn: s.code, cluster: s.x < 0 ? "west-academic" : "east", walkable: true, position: [s.x, s.z], size: [s.w, s.floors * 3.8, s.d],
    rotationY: 0, floors: s.floors, kind: campusKind(s), accuracy: "estimated",
    referenceIds: ["REF_SECONDARY_ZONE_PLACEHOLDER"],
  })),
];

export function structureGroundY(s: SecondaryStructure): number {
  return sampleGroundElevation(s.position[0], s.position[1]);
}

/** Axis-aligned bounds of a footprint after its yaw. A zero yaw matches the raw size. */
export function rotatedFootprint(s: SecondaryStructure) {
  const hx = s.size[0] / 2;
  const hz = s.size[2] / 2;
  const cos = Math.abs(Math.cos(s.rotationY));
  const sin = Math.abs(Math.sin(s.rotationY));
  return {
    halfW: hx * cos + hz * sin,
    halfD: hx * sin + hz * cos,
  };
}

/** A local footprint corner in world XZ, using the building yaw. */
export function footprintCorner(s: SecondaryStructure, dx: number, dz: number) {
  const cos = Math.cos(s.rotationY);
  const sin = Math.sin(s.rotationY);
  return {
    x: s.position[0] + dx * cos + dz * sin,
    z: s.position[1] - dx * sin + dz * cos,
  };
}
