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
    | "eng-tower";
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
    kind: "hip-roof-block",
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
    kind: "hall",
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
  if (site.id === "engineering") return "eng-tower";
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
