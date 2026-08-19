import {
  AVENUE_PAVED_WIDTH,
  AVENUE_PLANTING_WIDTH,
  AXIS,
  DOLPHIN_ISLAND_RADIUS,
  PLAZA_RADIUS,
  SCROLL_PLAZA_SIZE,
  corridorHalfWidth,
} from "./axis.ts";
import { COLLIDERS } from "./colliders.ts";
import { KENAN, KENAN_TOP_Z } from "./kenan.ts";
import { LIBRARY, PALACE, palaceHallZs } from "./landmarks.ts";
import { hash2 } from "./math.ts";
import { WORLD_BOUNDS } from "./origin.ts";

/**
 * Reality placement for planting.
 *
 * Rule: inside a `reality` zone nothing is scattered at random. Every plant is
 * either listed explicitly (specimen trees) or generated from the corridor data
 * that also builds the paving — a hedge follows the same verge polyline as the
 * kerb, so it can never drift off it. Random scatter is confined to the
 * backdrop, where it only contributes silhouette.
 */
export type PlantSpecies =
  | "banyan" // 榕樹：低分枝、寬冠
  | "broadleaf" // 大型闊葉樹
  | "camphor" // 樟樹類，較直立
  | "palm" // 棕櫚/高幹
  | "shrub" // 修剪灌木
  | "azalea" // 杜鵑
  | "flowerbed" // 花圃
  | "groundcover" // 地被
  | "moss"; // 青苔（潮濕面）

export type PlantInstance = {
  species: PlantSpecies;
  x: number;
  z: number;
  /** Uniform scale multiplier on the species' base size. */
  scale: number;
  rotationY: number;
};

const plant = (
  species: PlantSpecies,
  x: number,
  z: number,
  scale = 1,
  rotationY = 0,
): PlantInstance => ({ species, x, z, scale, rotationY });

function blockedByBuilding(x: number, z: number, margin: number): boolean {
  return COLLIDERS.some(
    (b) => x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin,
  );
}

/** 克難坡: planted banks either side, wetter and mossier towards the bottom. */
function kenanPlanting(): PlantInstance[] {
  const out: PlantInstance[] = [];
  const wallOuter = KENAN.width / 2 + KENAN.wallThickness;
  let i = 0;
  for (let z = KENAN.bottomZ + 6; z > KENAN_TOP_Z - 2; z -= 6.4, i++) {
    for (const s of [-1, 1] as const) {
      // Alternate the offset so the canopy does not read as a corridor of clones.
      const off = wallOuter + 2.6 + (i % 3) * 1.5;
      const species: PlantSpecies = i % 4 === 0 ? "banyan" : i % 3 === 0 ? "camphor" : "broadleaf";
      out.push(plant(species, s * off, z + (s > 0 ? 1.9 : 0), 0.9 + ((i * 7) % 5) * 0.07, i * 0.7));
      out.push(plant("shrub", s * (wallOuter + 0.9), z - 2.1, 0.85 + (i % 2) * 0.14, 0));
    }
  }
  // Damp lower flight: moss on the bank foot and in the drainage channel.
  for (let z = KENAN.bottomZ; z > KENAN.bottomZ - 24; z -= 2.4) {
    for (const s of [-1, 1] as const) {
      out.push(plant("moss", s * (KENAN.width / 2 - 0.28), z, 1, 0));
      out.push(plant("groundcover", s * (wallOuter + 1.1), z - 1.1, 0.9, 0));
    }
  }
  return out;
}

/** 驚聲銅像廣場: ring of canopy outside the rim, azalea at the seating steps. */
function plazaPlanting(): PlantInstance[] {
  const out: PlantInstance[] = [];
  for (let a = 0; a < 14; a++) {
    const t = (a / 14) * Math.PI * 2;
    const r = PLAZA_RADIUS + 5.5 + (a % 3) * 1.6;
    const x = Math.sin(t) * r;
    const z = Math.cos(t) * r;
    if (z > KENAN_TOP_Z - 4) continue; // keep the slope mouth clear
    // ...and keep the avenue mouth clear on the north side.
    if (z < AXIS.plazaNorthZ && Math.abs(x) < 9) continue;
    out.push(plant(a % 3 === 0 ? "banyan" : "broadleaf", x, z, 1.05 + (a % 4) * 0.06, t));
  }
  for (let a = 0; a < 22; a++) {
    const t = Math.PI * 0.15 + (a / 22) * Math.PI * 1.7;
    const r = PLAZA_RADIUS + 1.5;
    out.push(plant("azalea", Math.sin(t) * r, Math.cos(t) * r, 0.9 + (a % 3) * 0.1, 0));
  }
  return out;
}

/**
 * 宮燈大道: azalea hedge on both verges, high canopy in the gaps between halls,
 * and a banyan on the hall corners the way the real avenue reads.
 */
function avenuePlanting(): PlantInstance[] {
  const out: PlantInstance[] = [];
  const vergeX = AVENUE_PAVED_WIDTH / 2 + AVENUE_PLANTING_WIDTH / 2;
  let i = 0;
  for (let z = AXIS.avenueSouthZ - 1.4; z > AXIS.avenueNorthZ; z -= 2.3, i++) {
    for (const s of [-1, 1] as const) {
      out.push(plant("azalea", s * vergeX, z, 0.82 + (i % 4) * 0.09, 0));
      if (i % 5 === 2) out.push(plant("groundcover", s * (vergeX + 1.2), z, 1, 0));
    }
  }
  const hallZs = palaceHallZs();
  for (let h = 0; h < hallZs.length; h++) {
    const z = hallZs[h];
    for (const s of [-1, 1] as const) {
      // Canopy in the gap between two halls, clear of the colonnade.
      const gapZ = z - PALACE.pitch / 2;
      if (gapZ < AXIS.avenueNorthZ) continue;
      out.push(plant(h % 2 === 0 ? "banyan" : "broadleaf", s * (PALACE.offsetX - 2.5), gapZ, 1.25, h));
      out.push(plant("shrub", s * (AVENUE_PAVED_WIDTH / 2 + 4.6), gapZ + 3.2, 1.05, 0));
      out.push(plant("flowerbed", s * (AVENUE_PAVED_WIDTH / 2 + 3.4), z, 1, 0));
    }
  }
  // A few palms mark the avenue's north end, as at the roundabout approach.
  for (let k = 0; k < 4; k++) {
    for (const s of [-1, 1] as const) {
      out.push(plant("palm", s * 8.5, AXIS.avenueNorthZ + 4 + k * 7, 1.1, 0));
    }
  }
  // Behind both hall rows the hillside canopy closes over, so looking across
  // the avenue you see roofs floating in green — the defining aerial view.
  let bi = 0;
  for (let z = AXIS.avenueSouthZ - 6; z > AXIS.avenueNorthZ; z -= 6.5, bi++) {
    for (const s of [-1, 1] as const) {
      const back = PALACE.offsetX + PALACE.hallDepth / 2 + 4 + (bi % 3) * 3.4;
      const species: PlantSpecies = bi % 3 === 0 ? "banyan" : bi % 2 === 0 ? "broadleaf" : "camphor";
      out.push(plant(species, s * back, z + (s > 0 ? 2.6 : 0), 1.05 + ((bi * 5) % 4) * 0.12, bi * 1.3));
    }
  }
  return out;
}

/** 海豚里程碑 island + 書卷廣場 perimeter. */
function dolphinAndScrollPlanting(): PlantInstance[] {
  const out: PlantInstance[] = [];
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2;
    const r = DOLPHIN_ISLAND_RADIUS - 2.6;
    out.push(plant("shrub", Math.sin(t) * r, AXIS.dolphinZ + Math.cos(t) * r, 0.8, t));
  }
  out.push(plant("broadleaf", -3.2, AXIS.dolphinZ - 3.4, 1.15, 0.4));
  out.push(plant("banyan", 3.4, AXIS.dolphinZ - 4.2, 1.05, 1.7));
  out.push(plant("camphor", -4.0, AXIS.dolphinZ + 3.6, 1.2, 2.6));
  // Tall screen north of the roundabout so the avenue vista ends in canopy
  // rather than in a bare context facade, as it does in reality.
  for (const [x, z, sc] of [
    [-8, AXIS.dolphinZ - 14, 1.4],
    [8.5, AXIS.dolphinZ - 15, 1.3],
    [-13, AXIS.dolphinZ - 18, 1.25],
    [13.5, AXIS.dolphinZ - 19, 1.35],
  ] as const) {
    out.push(plant("banyan", x, z, sc, x));
  }

  const [w, d] = SCROLL_PLAZA_SIZE;
  for (let k = 0; k < 8; k++) {
    const z = AXIS.scrollPlazaZ + d / 2 - 3 - k * ((d - 6) / 7);
    for (const s of [-1, 1] as const) {
      out.push(plant(k % 3 === 0 ? "camphor" : "broadleaf", s * (w / 2 + 4), z, 1.1, k));
      out.push(plant("azalea", s * (w / 2 - 1.6), z, 0.85, 0));
    }
  }
  return out;
}

/** 圖書館 forecourt hedges + 牧羊草坪 specimen trees on the grass slope. */
function libraryPlanting(): PlantInstance[] {
  const out: PlantInstance[] = [];
  for (let k = 0; k < 14; k++) {
    const x = -16 + k * 4.6;
    out.push(plant("shrub", x, AXIS.libraryFrontZ + 3.2, 0.9 + (k % 3) * 0.1, 0));
  }
  // Specimen banyans on the meadow slope, clear of 驚聲大樓's footprint.
  for (const [x, z, s] of [
    [-30, -292, 1.35],
    [-52, -300, 1.5],
    [-72, -294, 1.2],
    [-74, -312, 1.3],
    [-58, -320, 1.45],
    [-34, -308, 1.15],
    [-88, -300, 1.1],
    [-84, -270, 1.25],
  ] as const) {
    out.push(plant("banyan", x, z, s, x * 0.11));
  }
  for (let k = 0; k < 10; k++) {
    out.push(plant("flowerbed", -22 + k * 5.2, AXIS.libraryFrontZ + 12.5, 1, 0));
  }
  return out;
}

export const CURATED_PLANTS: PlantInstance[] = [
  ...kenanPlanting(),
  ...plazaPlanting(),
  ...avenuePlanting(),
  ...dolphinAndScrollPlanting(),
  ...libraryPlanting(),
];

/**
 * Backdrop scatter. Deliberately excluded from every `reality` zone: it starts
 * beyond the corridor half-width plus a margin, so it can never wander into a
 * calibrated view.
 * @param density 0..1 multiplier used to thin planting on mobile.
 */
export function scatterPlants(density: number): PlantInstance[] {
  const out: PlantInstance[] = [];
  // 五虎崗 is a forested hill: near the corridor the canopy is nearly closed
  // (~9 m spacing), thinning out towards the map edge. The buildings should
  // read as emerging from trees, not standing on a lawn.
  for (let x = WORLD_BOUNDS.minX + 16; x < WORLD_BOUNDS.maxX - 16; x += 9) {
    for (let z = WORLD_BOUNDS.minZ + 16; z < WORLD_BOUNDS.maxZ - 16; z += 9) {
      const jx = x + (hash2(x, z, 11) - 0.5) * 7.5;
      const jz = z + (hash2(x, z, 23) - 0.5) * 7.5;
      const margin = Math.abs(jx) - corridorHalfWidth(jz);
      if (margin < 22) continue; // never inside or looming over the corridor
      if (jx < -150) continue; // river
      // 牧羊草坪 stays an open lawn with a clear view west to the river —
      // only the curated specimen banyans stand on it.
      if (Math.hypot(jx + 58, jz + 298) < 50) continue;
      // Keep the west view corridor from the meadow to the water open too.
      if (jx < -100 && jz < -260 && jz > -340) continue;
      if (blockedByBuilding(jx, jz, 5)) continue;
      // Density falls off with distance from the corridor so the far edges
      // stay cheap, and the caller's density knob scales the whole hill.
      const falloff = margin > 130 ? 0.55 : 1;
      if (hash2(x, z, 37) > density * falloff) continue;
      const r = hash2(x, z, 53);
      const species: PlantSpecies = r < 0.18 ? "camphor" : r < 0.38 ? "banyan" : "broadleaf";
      out.push(plant(species, jx, jz, 0.9 + hash2(x, z, 71) * 0.65, hash2(x, z, 89) * Math.PI * 2));
    }
  }
  return out;
}

/** Mown lawn patches, used to swap the grass material rather than add meshes. */
export const LAWN_AREAS = [
  { id: "meadow", center: [-58, -298] as const, radius: 54 },
  { id: "library-west-lawn", center: [-14, LIBRARY.center[1]] as const, radius: 20 },
  { id: "plaza-south-lawn", center: [22, 14] as const, radius: 16 },
] as const;
