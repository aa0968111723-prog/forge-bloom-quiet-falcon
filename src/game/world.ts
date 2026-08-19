export type TimeOfDay = "day" | "sunset" | "night";

export type Landmark = {
  id: string;
  name: string;
  nameEn: string;
  year: string;
  blurb: string;
  /** Plaque / interact point */
  x: number;
  z: number;
  radius: number;
  mapColor: string;
};

export const SPAWN = { x: 0, y: 1.1, z: 78 };

export const LANDMARKS: Landmark[] = [
  {
    id: "kenan",
    name: "克難坡",
    nameEn: "Ke-nan Slope",
    year: "1953",
    blurb:
      "一百三十二階陡坡，是淡江草創時進入校園的必經要道。它象徵篳路藍縷、以啟山林，也是校訓「樸實剛毅」最具體的體能課。每學年開學典禮，師生仍會重走這段巡禮。",
    x: 0,
    z: 68,
    radius: 14,
    mapColor: "#cfc4b0",
  },
  {
    id: "statue",
    name: "驚聲銅像廣場",
    nameEn: "Ching-sheng Plaza",
    year: "—",
    blurb:
      "克難坡頂的圓形廣場，紀念創辦人張建邦之父張驚聲先生。看台仿羅馬階梯，基座題「功在作人」。夜間靜謐，是許多淡江人的第一個校園記憶點。",
    x: 0,
    z: 37.6,
    radius: 6,
    mapColor: "#b9a078",
  },
  {
    id: "palace",
    name: "宮燈教室",
    nameEn: "Palace Classrooms",
    year: "1954",
    blurb:
      "碧瓦紅牆、迴廊朱柱，是淡水校園永久校舍的起點，也是「中學為體、西學為用」的建築宣言。教室沿宮燈大道兩側展開，比鄰仿宋代庭園「覺軒」，無數偶像劇在此取景。",
    x: -5,
    z: 28,
    radius: 4.6,
    mapColor: "#c45c4a",
  },
  {
    id: "lantern",
    name: "宮燈大道",
    nameEn: "Lantern Avenue",
    year: "—",
    blurb:
      "長約二百公尺的石板步道，宮燈教室夾道、宮燈低垂，西望淡水河夕照。是新淡水八景、校友返校必訪，也是台灣偶像劇最愛的校園場景。",
    x: 0,
    z: 21,
    radius: 4.6,
    mapColor: "#d9783a",
  },
  {
    id: "dolphin",
    name: "海豚里程碑",
    nameEn: "Dolphin Milestone",
    year: "—",
    blurb:
      "宮燈大道北端圓環，雕塑家王秀杞作品。海豚由全校同學票選為吉祥物，象徵智慧與遨遊四海。基座鐫刻張創辦人勉詞：「立足淡江，放眼世界，掌握資訊，開創未來」。",
    x: 0,
    z: 11.2,
    radius: 4.4,
    mapColor: "#7eb0c8",
  },
  {
    id: "scroll",
    name: "書卷廣場",
    nameEn: "Scroll Plaza",
    year: "1986",
    blurb:
      "驚聲大樓與覺生紀念圖書館前的集會心臟。中央四片竹卷由校友林貴榮設計，象徵古代簡冊與校訓四字；俯瞰又像馬達轉軸。學生暱稱「蛋捲廣場」。",
    x: 0,
    z: -14,
    radius: 6,
    mapColor: "#d9c39a",
  },
  {
    id: "library",
    name: "覺生紀念圖書館",
    nameEn: "Chueh-sheng Library",
    year: "—",
    blurb:
      "牧羊草坪旁的九層開放式圖書館，順山勢而建，是淡江人引以為傲的知識地標。館前長椅上有「閱讀的女孩」雕像，黃昏時樓體映著河面的光。",
    x: 8,
    z: -20.2,
    radius: 5,
    mapColor: "#8aa3b8",
  },
  {
    id: "sheep",
    name: "牧羊草坪",
    nameEn: "Shepherd's Meadow",
    year: "—",
    blurb:
      "校園最開闊的綠地。草坡上有李雙澤「唱自己的歌」紀念雕塑，午後常有人席地遠眺觀音山。圖書館的影子會慢慢爬過這片草地。",
    x: 22,
    z: 0,
    radius: 6,
    mapColor: "#6a9a62",
  },
  {
    id: "museum",
    name: "海事博物館",
    nameEn: "Maritime Museum",
    year: "—",
    blurb:
      "校園裡最容易一眼認出的白色船型建築。前身為航海學系商船學館，舷側常停放 F-100 戰鬥機與直升機模型，把淡江與海洋的緣分停泊在五虎崗上。",
    x: 49,
    z: -6.4,
    radius: 6,
    mapColor: "#e8eef4",
  },
  {
    id: "tigers",
    name: "五虎碑",
    nameEn: "Five Tigers Stele",
    year: "—",
    blurb:
      "紹謨紀念體育館前的銅雕，五虎環抱，取五虎崗之名。基座刻有張創辦人「五虎崗傳奇」，要淡江人把旺盛的氣勢留在這座山上。",
    x: 40,
    z: 16,
    radius: 5.2,
    mapColor: "#8a6a44",
  },
];

export const LANDMARK_BY_ID = Object.fromEntries(
  LANDMARKS.map((l) => [l.id, l]),
) as Record<string, Landmark>;

export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };

export const COLLIDERS: AABB[] = [
  { minX: -14.2, maxX: -5.6, minZ: 13.0, maxZ: 41.2 }, // palace west + colonnade
  { minX: 5.6, maxX: 14.2, minZ: 13.0, maxZ: 41.2 }, // palace east + colonnade
  { minX: 2.2, maxX: 22.2, minZ: -42.5, maxZ: -21.5 }, // library
  { minX: -29, maxX: -7.5, minZ: -37, maxZ: -17 }, // ching-sheng
  { minX: 28, maxX: 46, minZ: 1, maxZ: 15 }, // business
  { minX: 42, maxX: 64, minZ: 11, maxZ: 27 }, // gym
  { minX: 38, maxX: 64, minZ: -24, maxZ: -10 }, // ship
  { minX: -4.2, maxX: 4.2, minZ: 40.2, maxZ: 44.4 }, // statue
  { minX: -2.7, maxX: 2.7, minZ: 4.8, maxZ: 9.4 }, // dolphin
  { minX: -30, maxX: -18.5, minZ: 36, maxZ: 46 }, // juexuan pavilion
  { minX: -5.1, maxX: 5.1, minZ: 88.6, maxZ: 91.4 }, // south gate
];

/** Height of the two-flight Ke-nan stair corridor (center line). */
export function kenanY(z: number): number | null {
  if (z >= 82) return 0.04;
  if (z > 66 && z < 82) {
    const t = (82 - z) / 16;
    return 0.12 + t * 7.1;
  }
  if (z > 62 && z <= 66) return 7.35;
  if (z > 44 && z <= 62) {
    const t = (62 - z) / 18;
    return 7.35 + t * 8.8;
  }
  return null;
}

export function terrainHeight(x: number, z: number): number {
  const ax = Math.abs(x);
  const stair = kenanY(z);
  if (stair !== null) {
    if (ax < 7.2) return stair;
    if (ax < 22) {
      const u = (ax - 7.2) / 14.8;
      const s = u * u * (3 - 2 * u);
      return stair + s * (16.15 - stair);
    }
  }
  if (z >= 82) return 0.04;

  let h = 16.15;
  if (x < -72) {
    const t = Math.min(1, (-72 - x) / 48);
    h -= t * 22;
  }
  const onSpine = ax < 8 && z < 44 && z > -48;
  const onLantern = ax < 17 && z <= 42 && z >= 12;
  if (!onSpine && !onLantern) {
    h += Math.sin(x * 0.035) * 0.28 + Math.cos(z * 0.04) * 0.24;
  }
  const knoll = Math.hypot(x - 12, z + 32);
  if (knoll < 18 && (ax > 9 || z < -24)) {
    h += (1 - knoll / 18) * 1.05;
  }
  return h;
}

export function resolveCollision(
  x: number,
  z: number,
  radius: number,
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (const b of COLLIDERS) {
    const cx = Math.min(Math.max(px, b.minX), b.maxX);
    const cz = Math.min(Math.max(pz, b.minZ), b.maxZ);
    let dx = px - cx;
    let dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 < 1e-8) {
      const left = px - b.minX;
      const right = b.maxX - px;
      const top = pz - b.minZ;
      const bot = b.maxZ - pz;
      const m = Math.min(left, right, top, bot);
      if (m === left) px = b.minX - radius;
      else if (m === right) px = b.maxX + radius;
      else if (m === top) pz = b.minZ - radius;
      else pz = b.maxZ + radius;
      continue;
    }
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    px += dx * push;
    pz += dz * push;
  }
  px = Math.min(Math.max(px, -118), 88);
  pz = Math.min(Math.max(pz, -68), 92);
  return { x: px, z: pz };
}

export function landmarkAt(x: number, z: number): Landmark | null {
  let best: Landmark | null = null;
  let bestD = Infinity;
  for (const l of LANDMARKS) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d < l.radius && d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

export const TIME_PRESETS: Record<
  TimeOfDay,
  {
    sun: string;
    sky: string;
    fog: string;
    hemiSky: string;
    hemiGround: string;
    sunIntensity: number;
    hemiIntensity: number;
    sunPos: [number, number, number];
    fogNear: number;
    fogFar: number;
  }
> = {
  day: {
    sun: "#fff3d6",
    sky: "#8ec6e3",
    fog: "#c5d7e4",
    hemiSky: "#d7ecf8",
    hemiGround: "#b9a888",
    sunIntensity: 1.55,
    hemiIntensity: 0.7,
    sunPos: [48, 70, 18],
    fogNear: 55,
    fogFar: 210,
  },
  sunset: {
    sun: "#ffb068",
    sky: "#e8965a",
    fog: "#e3a06c",
    hemiSky: "#ffc9a0",
    hemiGround: "#8a5a3c",
    sunIntensity: 1.25,
    hemiIntensity: 0.55,
    sunPos: [-90, 16, 12],
    fogNear: 40,
    fogFar: 180,
  },
  night: {
    sun: "#8aa0c8",
    sky: "#0b1220",
    fog: "#0c1422",
    hemiSky: "#1a2740",
    hemiGround: "#0a0c12",
    sunIntensity: 0.12,
    hemiIntensity: 0.18,
    sunPos: [20, 55, -40],
    fogNear: 25,
    fogFar: 140,
  },
};
