#!/usr/bin/env node
/**
 * Tamkang material library generator.
 * ===================================
 *
 * Writes `public/materials/tamkang/<group>/<name>-{basecolor,normal,roughness,ao}.png`.
 *
 * Why generate rather than ship photographs: the pre-Reality-Pass scene shared
 * four JPEGs across the entire campus, which is the single loudest "this is a
 * generic 3D demo" signal. Real photographs of the campus are not ours to
 * redistribute, so instead each surface gets its own procedural PBR set built
 * from a height field: the stone treads of 克難坡 wear differently from the
 * red plaster of 宮燈教室, the avenue slabs have joints in the right rhythm, and
 * the damp lower flight can carry moss.
 *
 * Each material declares `height`, `colour` and `roughness` as functions of
 * (u, v). The normal map is differentiated from the height field and the AO map
 * is derived from local concavity, so the four maps always agree.
 *
 * Run: npm run gen:materials   (output is committed; this is reproducible)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { encodePng } from "./png.mjs";
import { clamp01, fbm, hexRgb, mix, mixRgb, smoothstep, tilingNoise, tilingWorley } from "./texture-noise.mjs";

const OUT_ROOT = join(process.cwd(), "public", "materials", "tamkang");

/* ------------------------------------------------------------------ helpers */

/**
 * Rectangular brick/slab courses. Returns joint mask + per-unit id.
 * `offsetPerRow` is in *fractions of a unit*, so 0.5 gives a running bond and
 * an integer gives stack bond (no visible offset at all).
 */
function courses(u, v, cols, rows, offsetPerRow, joint) {
  const row = Math.floor(v * rows);
  const shifted = u + (row * offsetPerRow) / cols;
  const col = Math.floor(shifted * cols);
  const fu = shifted * cols - col;
  const fv = v * rows - row;
  const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
  return {
    joint: 1 - smoothstep(0, joint, edge),
    id: (col * 37 + row * 91) % 251,
    fu,
    fv,
    row,
    col,
  };
}

/** Barrel-tile ridges, as on the 宮燈教室 green glazed roof. */
function pantile(u, cols) {
  const t = u * cols;
  const f = t - Math.floor(t);
  const ridge = Math.sin(f * Math.PI);
  return { ridge, seam: 1 - smoothstep(0, 0.09, Math.min(f, 1 - f)), id: Math.floor(t) };
}

/* ---------------------------------------------------------------- materials */

const KENAN_REFS = ["REF_STAIR_TYPICAL_RISE", "REF_KENAN_STEP_COUNT"];

const MATERIALS = [
  {
    group: "kenan",
    name: "stone-step",
    size: 512,
    ao: true,
    note: "克難坡石階：洗石子踏面，鼻端磨亮、內側積灰",
    referenceIds: KENAN_REFS,
    height(u, v) {
      const grit = fbm(u, v, 24, 4, 11) * 0.5 + tilingWorley(u, v, 26, 3) * 0.5;
      const { joint } = courses(u, v, 4, 2, 0.5, 0.06);
      return grit * 0.55 - joint * 0.45;
    },
    colour(u, v) {
      const base = hexRgb("#b9b2a6");
      const pale = hexRgb("#d2ccc1");
      const dark = hexRgb("#8d857a");
      const grit = tilingWorley(u, v, 26, 3);
      const wear = fbm(u, v, 6, 4, 91);
      // Nosing (bottom of the tile) is walked smooth and lighter.
      const nosing = smoothstep(0.86, 1, v);
      let c = mixRgb(base, pale, grit * 0.7);
      c = mixRgb(c, dark, clamp01(1 - wear) * 0.4);
      return mixRgb(c, pale, nosing * 0.35);
    },
    roughness(u, v) {
      const nosing = smoothstep(0.86, 1, v);
      return mix(0.93, 0.68, nosing) - tilingWorley(u, v, 26, 3) * 0.06;
    },
  },
  {
    group: "kenan",
    name: "retaining-wall",
    size: 256,
    note: "護牆：清水混凝土，模板接縫與滴水痕",
    referenceIds: KENAN_REFS,
    height(u, v) {
      const form = 1 - smoothstep(0, 0.035, Math.abs((v * 4) % 1 - 0.5) * 2 - 0.9);
      return fbm(u, v, 16, 4, 5) * 0.4 - form * 0.3;
    },
    colour(u, v) {
      const c = hexRgb("#a8a49c");
      const stain = clamp01(fbm(u * 0.4, v * 3, 8, 4, 61) - 0.35) * 1.6;
      // Vertical rain streaks below the coping.
      const streak = smoothstep(0.4, 1, v) * clamp01(tilingNoise(u, 0.5, 40, 17) - 0.42) * 3;
      return mixRgb(mixRgb(c, hexRgb("#6f6d66"), stain * 0.5), hexRgb("#7d8278"), streak * 0.6);
    },
    roughness: () => 0.95,
  },
  {
    group: "kenan",
    name: "old-wall",
    size: 256,
    note: "舊牆面：早期砌石加水泥粉刷、局部剝落",
    referenceIds: KENAN_REFS,
    height(u, v) {
      const { joint, id } = courses(u, v, 6, 8, 0.5, 0.09);
      const spall = clamp01(fbm(u, v, 5, 3, 23) - 0.55) * 2;
      return (id % 7) / 40 + fbm(u, v, 20, 3, 31) * 0.3 - joint * 0.6 - spall * 0.5;
    },
    colour(u, v) {
      const { joint, id } = courses(u, v, 6, 8, 0.5, 0.09);
      const stone = mixRgb(hexRgb("#9a9184"), hexRgb("#7c7466"), (id % 11) / 11);
      const mortar = hexRgb("#b6b0a4");
      const spall = clamp01(fbm(u, v, 5, 3, 23) - 0.55) * 2;
      return mixRgb(mixRgb(stone, mortar, joint), hexRgb("#8a7f6c"), spall * 0.7);
    },
    roughness: () => 0.96,
  },
  {
    group: "kenan",
    name: "moss",
    size: 256,
    note: "青苔：潮濕坡面與排水溝邊，淡水冬季常見",
    referenceIds: ["REF_TAMSUI_WEATHER"],
    height(u, v) {
      return fbm(u, v, 12, 4, 71) * 0.7 + tilingWorley(u, v, 18, 9) * 0.3;
    },
    colour(u, v) {
      const n = fbm(u, v, 10, 4, 71);
      const c = mixRgb(hexRgb("#3f5b33"), hexRgb("#6d8a45"), n);
      return mixRgb(c, hexRgb("#26361f"), clamp01(1 - n) * 0.5);
    },
    roughness: (u, v) => 0.82 - fbm(u, v, 10, 3, 71) * 0.12,
  },
  {
    group: "kenan",
    name: "wet-concrete",
    size: 256,
    note: "潮濕鋪面：雨後淡水的地表，反射變強、彩度下降",
    referenceIds: ["REF_TAMSUI_WEATHER"],
    height: (u, v) => fbm(u, v, 22, 4, 13) * 0.35,
    colour(u, v) {
      const damp = fbm(u, v, 6, 4, 43);
      return mixRgb(hexRgb("#6f7276"), hexRgb("#4d5155"), damp);
    },
    roughness: (u, v) => 0.34 + fbm(u, v, 6, 3, 43) * 0.22,
  },

  {
    group: "palace",
    name: "red-wall",
    size: 512,
    ao: true,
    note: "宮燈教室紅牆：紅色水泥粉光，牆腳泛白、上緣積塵",
    referenceIds: ["REF_PALACE_CLASSROOMS_1954"],
    height(u, v) {
      const trowel = fbm(u, v, 14, 4, 3) * 0.4;
      const band = 1 - smoothstep(0, 0.02, Math.abs(v - 0.08));
      return trowel - band * 0.35;
    },
    colour(u, v) {
      const base = hexRgb("#8f2f22");
      const lit = hexRgb("#a83d2b");
      const n = fbm(u, v, 9, 4, 3);
      let c = mixRgb(base, lit, n);
      // Rising damp at the plinth, dust wash at the top.
      c = mixRgb(c, hexRgb("#9a8b7a"), smoothstep(0.14, 0, v) * 0.55);
      c = mixRgb(c, hexRgb("#6d2a20"), smoothstep(0.88, 1, v) * 0.3);
      return c;
    },
    roughness: (u, v) => 0.86 - fbm(u, v, 9, 3, 3) * 0.08,
  },
  {
    group: "palace",
    name: "green-roof-tile",
    size: 512,
    ao: true,
    note: "碧瓦：綠色琉璃筒瓦，接縫積苔",
    referenceIds: ["REF_PALACE_CLASSROOMS_1954"],
    height(u, v) {
      const { ridge, seam } = pantile(u, 6);
      // Each course laps over the one below, so the lap line is a real step.
      const fv = (v * 7) % 1;
      const lap = 1 - smoothstep(0, 0.1, fv);
      return ridge ** 1.6 * 0.85 - seam * 0.45 - lap * 0.4;
    },
    colour(u, v) {
      const { ridge, seam, id } = pantile(u, 6);
      const fv = (v * 7) % 1;
      const lap = 1 - smoothstep(0, 0.12, fv);
      const course = Math.floor(v * 7);
      const glaze = mixRgb(hexRgb("#25604a"), hexRgb("#4f9a75"), ridge ** 1.4);
      const varied = mixRgb(glaze, hexRgb("#1d4a38"), ((id * 53 + course * 29) % 17) / 30);
      const mossy = clamp01(fbm(u, v, 8, 3, 77) - 0.5) * 2;
      const shaded = mixRgb(varied, hexRgb("#0c261a"), Math.max(seam * 0.7, lap * 0.85));
      return mixRgb(shaded, hexRgb("#4a6b3a"), mossy * 0.5);
    },
    // Glazed tile is the shiniest thing on the campus after glass.
    roughness: (u, v) => 0.3 + (1 - pantile(u, 6).ridge) * 0.25 + fbm(u, v, 8, 2, 77) * 0.1,
  },
  {
    group: "palace",
    name: "wood-column",
    size: 256,
    note: "朱柱：迴廊漆木柱，直紋與漆面磨損",
    referenceIds: ["REF_PALACE_CLASSROOMS_1954"],
    height(u, v) {
      return fbm(u * 6, v * 0.4, 18, 4, 29) * 0.5;
    },
    colour(u, v) {
      const grain = fbm(u * 8, v * 0.35, 20, 4, 29);
      const c = mixRgb(hexRgb("#7d2b1e"), hexRgb("#a03826"), grain);
      return mixRgb(c, hexRgb("#5d2016"), clamp01(1 - grain) * 0.4);
    },
    roughness: (u, v) => 0.52 + fbm(u * 8, v * 0.35, 20, 3, 29) * 0.2,
  },
  {
    group: "palace",
    name: "lattice-window",
    size: 512,
    ao: true,
    note: "窗格：木框方格窗，格內為室內暗面",
    referenceIds: ["REF_PALACE_CLASSROOMS_1954"],
    height(u, v) {
      const g = 6;
      const fu = (u * g) % 1;
      const fv = (v * g) % 1;
      const bar = Math.max(
        1 - smoothstep(0.05, 0.14, Math.min(fu, 1 - fu)),
        1 - smoothstep(0.05, 0.14, Math.min(fv, 1 - fv)),
      );
      const frame = Math.max(
        1 - smoothstep(0.01, 0.05, Math.min(u, 1 - u)),
        1 - smoothstep(0.01, 0.05, Math.min(v, 1 - v)),
      );
      return Math.max(bar, frame * 1.2) * 0.9;
    },
    colour(u, v) {
      const g = 6;
      const fu = (u * g) % 1;
      const fv = (v * g) % 1;
      const bar = Math.max(
        1 - smoothstep(0.05, 0.14, Math.min(fu, 1 - fu)),
        1 - smoothstep(0.05, 0.14, Math.min(fv, 1 - fv)),
      );
      const frame = Math.max(
        1 - smoothstep(0.01, 0.05, Math.min(u, 1 - u)),
        1 - smoothstep(0.01, 0.05, Math.min(v, 1 - v)),
      );
      const wood = mixRgb(hexRgb("#6f2a1d"), hexRgb("#8c3826"), fbm(u, v, 12, 3, 9));
      const pane = mixRgb(hexRgb("#243038"), hexRgb("#3b4a52"), fbm(u, v, 5, 3, 44));
      return mixRgb(pane, wood, Math.max(bar, frame));
    },
    roughness(u, v) {
      const g = 6;
      const bar = Math.max(
        1 - smoothstep(0.05, 0.14, Math.min((u * g) % 1, 1 - ((u * g) % 1))),
        1 - smoothstep(0.05, 0.14, Math.min((v * g) % 1, 1 - ((v * g) % 1))),
      );
      return mix(0.18, 0.66, bar);
    },
  },

  {
    group: "lantern",
    name: "stone-slab",
    size: 512,
    ao: true,
    note: "宮燈大道鋪面：花崗石板，錯縫排列、縫隙積塵",
    referenceIds: ["REF_LANTERN_AVENUE_LENGTH"],
    height(u, v) {
      const { joint, id } = courses(u, v, 3, 6, 0.5, 0.045);
      return (id % 5) / 60 + fbm(u, v, 26, 4, 19) * 0.28 - joint * 0.7;
    },
    colour(u, v) {
      const { joint, id } = courses(u, v, 3, 6, 0.5, 0.045);
      const slab = mixRgb(hexRgb("#a49e94"), hexRgb("#8b867d"), ((id * 29) % 13) / 13);
      const speckle = tilingWorley(u, v, 40, 5);
      const withSpeckle = mixRgb(slab, hexRgb("#c0bbb2"), speckle * 0.35);
      return mixRgb(withSpeckle, hexRgb("#66625b"), joint * 0.85);
    },
    roughness: (u, v) => 0.8 - tilingWorley(u, v, 40, 5) * 0.1,
  },
  {
    group: "lantern",
    name: "kerb",
    size: 256,
    note: "路緣石：預鑄混凝土緣石，上緣被輪胎擦白",
    referenceIds: ["REF_AXIS_STRAIGHT_ASSUMPTION"],
    height(u, v) {
      const seam = 1 - smoothstep(0, 0.03, Math.abs((u * 4) % 1 - 0.5) * 2 - 0.92);
      return fbm(u, v, 20, 3, 7) * 0.3 - seam * 0.5;
    },
    colour(u, v) {
      const c = mixRgb(hexRgb("#b4b0a8"), hexRgb("#98948c"), fbm(u, v, 12, 3, 7));
      return mixRgb(c, hexRgb("#d8d5cf"), smoothstep(0.7, 1, v) * 0.5);
    },
    roughness: () => 0.9,
  },
  {
    group: "lantern",
    name: "asphalt",
    size: 256,
    note: "柏油：車道面層，粒料外露、輪跡較光",
    referenceIds: ["REF_AXIS_STRAIGHT_ASSUMPTION"],
    height: (u, v) => tilingWorley(u, v, 34, 2) * 0.6 + fbm(u, v, 28, 3, 15) * 0.4,
    colour(u, v) {
      const agg = tilingWorley(u, v, 34, 2);
      const c = mixRgb(hexRgb("#3b3c3e"), hexRgb("#585a5c"), agg);
      return mixRgb(c, hexRgb("#2c2d2f"), fbm(u, v, 7, 3, 15) * 0.4);
    },
    roughness: (u, v) => 0.88 - tilingWorley(u, v, 34, 2) * 0.12,
  },
  {
    group: "lantern",
    name: "sidewalk",
    size: 256,
    note: "人行道：連鎖磚，人字形排列",
    referenceIds: ["REF_AXIS_STRAIGHT_ASSUMPTION"],
    height(u, v) {
      const { joint, id } = courses(u, v, 8, 4, 0.5, 0.07);
      return (id % 4) / 50 - joint * 0.6;
    },
    colour(u, v) {
      const { joint, id } = courses(u, v, 8, 4, 0.5, 0.07);
      const brick = mixRgb(hexRgb("#a89a86"), hexRgb("#8e8172"), ((id * 41) % 9) / 9);
      return mixRgb(brick, hexRgb("#6b655c"), joint * 0.8);
    },
    roughness: () => 0.92,
  },
  {
    group: "lantern",
    name: "tactile-paving",
    size: 256,
    note: "導盲磚：黃色點狀警示磚",
    referenceIds: ["REF_AXIS_STRAIGHT_ASSUMPTION"],
    height(u, v) {
      const g = 6;
      const fu = (u * g) % 1;
      const fv = (v * g) % 1;
      const d = Math.hypot(fu - 0.5, fv - 0.5);
      return (1 - smoothstep(0.2, 0.32, d)) * 0.9;
    },
    colour(u, v) {
      const g = 6;
      const d = Math.hypot(((u * g) % 1) - 0.5, ((v * g) % 1) - 0.5);
      const dot = 1 - smoothstep(0.2, 0.34, d);
      return mixRgb(hexRgb("#b9a04a"), hexRgb("#e0c25c"), dot);
    },
    roughness: () => 0.85,
  },

  {
    group: "library",
    name: "facade",
    size: 512,
    ao: true,
    note: "圖書館外牆：淺色面磚與水平分割線",
    referenceIds: ["REF_LIBRARY_NINE_FLOORS"],
    height(u, v) {
      const { joint, id } = courses(u, v, 10, 20, 0.5, 0.1);
      return (id % 3) / 70 + fbm(u, v, 18, 3, 63) * 0.22 - joint * 0.55;
    },
    colour(u, v) {
      const { joint, id } = courses(u, v, 10, 20, 0.5, 0.1);
      const tile = mixRgb(hexRgb("#c8c4ba"), hexRgb("#b2ada2"), ((id * 17) % 7) / 7);
      const weather = clamp01(fbm(u * 0.5, v * 2, 6, 3, 63) - 0.5) * 1.4;
      return mixRgb(mixRgb(tile, hexRgb("#8f8b83"), joint * 0.7), hexRgb("#9aa0a2"), weather * 0.35);
    },
    roughness: () => 0.78,
  },
  {
    group: "library",
    name: "glass",
    size: 256,
    note: "玻璃：帷幕與窗，反射為主、內部略可見",
    referenceIds: ["REF_LIBRARY_NINE_FLOORS"],
    height(u, v) {
      const mullion = Math.max(
        1 - smoothstep(0.02, 0.06, Math.min((u * 4) % 1, 1 - ((u * 4) % 1))),
        1 - smoothstep(0.02, 0.06, Math.min((v * 3) % 1, 1 - ((v * 3) % 1))),
      );
      return mullion * 0.8;
    },
    colour(u, v) {
      const mullion = Math.max(
        1 - smoothstep(0.02, 0.06, Math.min((u * 4) % 1, 1 - ((u * 4) % 1))),
        1 - smoothstep(0.02, 0.06, Math.min((v * 3) % 1, 1 - ((v * 3) % 1))),
      );
      const pane = mixRgb(hexRgb("#5e7b88"), hexRgb("#87a4ad"), v * 0.8 + fbm(u, v, 4, 2, 88) * 0.2);
      return mixRgb(pane, hexRgb("#6d6a63"), mullion);
    },
    roughness(u, v) {
      const mullion = Math.max(
        1 - smoothstep(0.02, 0.06, Math.min((u * 4) % 1, 1 - ((u * 4) % 1))),
        1 - smoothstep(0.02, 0.06, Math.min((v * 3) % 1, 1 - ((v * 3) % 1))),
      );
      return mix(0.08, 0.7, mullion);
    },
  },

  {
    group: "campus",
    name: "grass",
    size: 512,
    note: "草地：混合草皮，密度不均、有踩踏痕",
    referenceIds: ["REF_CAMPUS_ON_WUHU_HILL"],
    height: (u, v) => fbm(u, v, 40, 4, 101) * 0.6 + tilingWorley(u, v, 30, 4) * 0.4,
    colour(u, v) {
      const n = fbm(u, v, 22, 4, 101);
      const patch = fbm(u, v, 5, 3, 131);
      let c = mixRgb(hexRgb("#4e7238"), hexRgb("#6b8c42"), n);
      c = mixRgb(c, hexRgb("#3c5a2c"), clamp01(1 - patch) * 0.45);
      // Worn tracks where people cut the corner.
      return mixRgb(c, hexRgb("#7d7a52"), clamp01(patch - 0.72) * 2.2);
    },
    roughness: () => 0.94,
  },
  {
    group: "campus",
    name: "soil",
    size: 256,
    note: "泥土：花圃與樹下裸土",
    referenceIds: ["REF_CAMPUS_ON_WUHU_HILL"],
    height: (u, v) => fbm(u, v, 24, 4, 55) * 0.7 + tilingWorley(u, v, 20, 6) * 0.3,
    colour(u, v) {
      const n = fbm(u, v, 14, 4, 55);
      return mixRgb(hexRgb("#4a3a2b"), hexRgb("#6d573d"), n);
    },
    roughness: () => 0.96,
  },
  {
    group: "campus",
    name: "plaza-tile",
    size: 512,
    ao: true,
    note: "廣場地磚：大面積方磚，書卷廣場與圖書館前",
    referenceIds: ["REF_SCROLL_PLAZA_1986"],
    height(u, v) {
      const { joint, id } = courses(u, v, 4, 4, 0, 0.05);
      return (id % 3) / 80 + fbm(u, v, 30, 3, 27) * 0.2 - joint * 0.65;
    },
    colour(u, v) {
      const { joint, id } = courses(u, v, 4, 4, 0, 0.05);
      const tile = mixRgb(hexRgb("#bdb4a4"), hexRgb("#a79e8e"), ((id * 23) % 5) / 5);
      return mixRgb(tile, hexRgb("#7c7568"), joint * 0.8);
    },
    roughness: () => 0.84,
  },
  {
    group: "campus",
    name: "bronze",
    size: 256,
    note: "銅雕：驚聲銅像、海豚、五虎碑的青銅面",
    referenceIds: ["REF_CHINGSHENG_STATUE", "REF_DOLPHIN_MILESTONE"],
    height: (u, v) => fbm(u, v, 18, 4, 199) * 0.4,
    colour(u, v) {
      const n = fbm(u, v, 9, 4, 199);
      const patina = clamp01(fbm(u, v, 5, 3, 211) - 0.45) * 2;
      const metal = mixRgb(hexRgb("#4a3826"), hexRgb("#6b5334"), n);
      return mixRgb(metal, hexRgb("#5c7061"), patina * 0.55);
    },
    roughness: (u, v) => 0.42 + fbm(u, v, 9, 3, 199) * 0.2,
  },
];

/* ------------------------------------------------------------------ pipeline */

function generate(material) {
  const n = material.size;
  const colour = new Uint8Array(n * n * 3);
  const normal = new Uint8Array(n * n * 3);
  const rough = new Uint8Array(n * n);
  const ao = material.ao ? new Uint8Array(n * n) : null;

  // Materials are authored in Three.js UV space, where v = 0 is the *bottom* of
  // the surface. PNG rows run top-down and three.js sets flipY, so image row 0
  // is v = 1: convert here once so every material can say "v = 0 is the plinth".
  const uvV = (y) => 1 - (y + 0.5) / n;

  // Height field first: normal and AO are both derived from it.
  const height = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      height[y * n + x] = material.height((x + 0.5) / n, uvV(y));
    }
  }
  const at = (x, y) => height[(((y % n) + n) % n) * n + (((x % n) + n) % n)];

  // Height is authored in arbitrary units; scale so the relief reads at 1 m tiling.
  const strength = material.normalStrength ?? 2.2;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const u = (x + 0.5) / n;
      const v = uvV(y);

      const [r, g, b] = material.colour(u, v);
      colour[i * 3] = Math.round(clamp01(r) * 255);
      colour[i * 3 + 1] = Math.round(clamp01(g) * 255);
      colour[i * 3 + 2] = Math.round(clamp01(b) * 255);

      // Central differences -> tangent-space normal, OpenGL convention
      // N = normalize(-dh/du, -dh/dv, 1). Image y runs opposite to v, so
      // dh/dv = -dyImage and the green channel takes +dyImage.
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      normal[i * 3] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      normal[i * 3 + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      normal[i * 3 + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5);

      rough[i] = Math.round(clamp01(material.roughness(u, v)) * 255);

      if (ao) {
        // Concavity: how far below its neighbourhood mean this point sits.
        let mean = 0;
        let count = 0;
        for (let dj = -3; dj <= 3; dj += 3) {
          for (let di = -3; di <= 3; di += 3) {
            mean += at(x + di, y + dj);
            count += 1;
          }
        }
        mean /= count;
        const occl = clamp01((mean - at(x, y)) * 1.6);
        ao[i] = Math.round((1 - occl * 0.75) * 255);
      }
    }
  }

  return { colour, normal, rough, ao };
}

const manifest = [];
let bytes = 0;

for (const material of MATERIALS) {
  const { colour, normal, rough, ao } = generate(material);
  const dir = join(OUT_ROOT, material.group);
  mkdirSync(dir, { recursive: true });
  const maps = {};
  const write = (suffix, channels, data) => {
    const rel = `/materials/tamkang/${material.group}/${material.name}-${suffix}.png`;
    const abs = join(dir, `${material.name}-${suffix}.png`);
    const png = encodePng(material.size, material.size, channels, data);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, png);
    bytes += png.length;
    maps[suffix] = rel;
  };
  write("basecolor", 3, colour);
  write("normal", 3, normal);
  write("roughness", 1, rough);
  if (ao) write("ao", 1, ao);
  manifest.push({
    id: `${material.group}/${material.name}`,
    group: material.group,
    name: material.name,
    size: material.size,
    note: material.note,
    referenceIds: material.referenceIds ?? [],
    maps,
  });
}

mkdirSync(OUT_ROOT, { recursive: true });
writeFileSync(
  join(OUT_ROOT, "manifest.json"),
  JSON.stringify(
    {
      generator: "scripts/gen-materials.mjs",
      note: "Procedural PBR sets for the Tamkang reality pass. Regenerate with `npm run gen:materials`.",
      materials: manifest,
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `wrote ${manifest.length} materials (${manifest.reduce((a, m) => a + Object.keys(m.maps).length, 0)} maps, ${(bytes / 1048576).toFixed(2)} MB)`,
);
