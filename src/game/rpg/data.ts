/** Game content is fictional. Department names reference https://classic.tku.edu.tw/acad.asp . */
import { CAMPUS_SITES, siteEntrance } from "./campus.ts";
export type Discipline =
  | "engineering"
  | "science"
  | "humanities"
  | "business"
  | "language"
  | "education"
  | "international"
  | "computing"
  | "health";
export const DISCIPLINES = {
  engineering: {
    label: "工程構築",
    skill: "結構脈衝",
    color: "#75d3e8",
    damage: 40,
    range: 12,
    cooldown: 6,
    description: "向前釋放工程脈衝，擊退範圍內的異象。",
  },
  science: {
    label: "科學解析",
    skill: "共振反應",
    color: "#b9a2fa",
    damage: 52,
    range: 10,
    cooldown: 7,
    description: "以共振解析異象，造成高額範圍傷害。",
  },
  humanities: {
    label: "人文敘事",
    skill: "敘事解構",
    color: "#f4b28c",
    damage: 34,
    range: 14,
    cooldown: 5,
    description: "拆解異象敘事，遠距打擊並恢復 12 點專注。",
  },
  business: {
    label: "商管策略",
    skill: "資源調度",
    color: "#f6ce7a",
    damage: 32,
    range: 12,
    cooldown: 6,
    description: "調度資源打擊異象，同時恢復 20 點生命。",
  },
  language: {
    label: "語言符文",
    skill: "多重詠唱",
    color: "#92deb3",
    damage: 38,
    range: 16,
    cooldown: 6,
    description: "以語言符文同時攻擊範圍內的異象。",
  },
  education: {
    label: "教育引導",
    skill: "知識領域",
    color: "#f4a8cc",
    damage: 28,
    range: 13,
    cooldown: 5,
    description: "展開知識領域，傷害異象並恢復生命與專注。",
  },
  international: {
    label: "國際協調",
    skill: "協議共識",
    color: "#9cbde7",
    damage: 35,
    range: 14,
    cooldown: 6,
    description: "以協議符文化解周圍異象，並恢復 12 點專注。",
  },
  computing: {
    label: "智慧演算",
    skill: "模型推演",
    color: "#80dfd0",
    damage: 50,
    range: 14,
    cooldown: 8,
    description: "預測異象弱點，以運算陣列造成範圍傷害。",
  },
  health: {
    label: "健康照護",
    skill: "復原領域",
    color: "#b5d792",
    damage: 22,
    range: 12,
    cooldown: 5,
    description: "展開復原領域，打擊異象並恢復 40 點生命。",
  },
} as const;
export type Department = {
  id: string;
  name: string;
  college: string;
  discipline: Discipline;
};
const group = (
  college: string,
  discipline: Discipline,
  names: string[],
): Department[] =>
  names.map((name, i) => ({
    id: `${discipline}-${college}-${i}`,
    name,
    college,
    discipline,
  }));
export const DEPARTMENTS: Department[] = [
  ...group("文學院", "humanities", [
    "中國文學學系",
    "歷史學系",
    "資訊與圖書館學系",
    "大眾傳播學系",
    "資訊傳播學系",
  ]),
  ...group("理學院", "science", [
    "應用數學與數據科學學系",
    "物理學系",
    "化學學系",
    "尖端材料科學學士學位學程",
  ]),
  ...group("工學院", "engineering", [
    "建築學系",
    "土木工程學系",
    "水資源及環境工程學系",
    "機械與機電工程學系",
    "化學工程與材料工程學系",
    "電機工程學系",
    "資訊工程學系",
    "航空太空工程學系",
  ]),
  ...group("商管學院", "business", [
    "國際企業學系",
    "財務金融學系",
    "風險管理與保險學系",
    "經濟學系",
    "會計學系",
    "企業管理學系",
    "統計與資料科學學系",
    "資訊管理學系",
    "運輸管理學系",
    "公共行政暨法律學系",
    "管理科學學系",
  ]),
  ...group("外國語文學院", "language", [
    "英文學系",
    "日本語文學系",
    "歐洲語文學系",
  ]),
  ...group("教育學院", "education", ["教育科技學系", "教育與未來設計學系"]),
  ...group("國際事務學院", "international", [
    "外交與國際關係學系",
    "國際觀光管理學系",
    "全球政治經濟學系",
  ]),
  ...group("AI創智學院", "computing", ["人工智慧學系"]),
  ...group("精準健康學院", "health", [
    "高齡健康管理學研究所",
    "智慧照護產業學研究所",
  ]),
];
export const ITEMS = [
  {
    id: "notes",
    name: "課堂筆記",
    icon: "▤",
    category: "material",
    description: "異象留下的知識碎片，用於升級技能與建造。",
    maxStack: 99,
  },
  {
    id: "parts",
    name: "構築零件",
    icon: "⬡",
    category: "material",
    description: "搭建社團基地與防禦設施的材料。",
    maxStack: 99,
  },
  {
    id: "coffee",
    name: "冰咖啡",
    icon: "☕",
    category: "consumable",
    description: "恢復 45 點生命；滿血時不消耗。",
    maxStack: 20,
  },
  {
    id: "tea",
    name: "烏龍茶",
    icon: "♧",
    category: "consumable",
    description: "恢復 55 點專注；專注全滿時不消耗。",
    maxStack: 20,
  },
  {
    id: "credit",
    name: "學分結晶",
    icon: "◇",
    category: "rare",
    description: "完成考試與報告異象獲得的結晶。",
    maxStack: 99,
  },
  {
    id: "badge",
    name: "五虎崗徽章",
    icon: "✧",
    category: "equipment",
    description: "裝備後最大生命 +25、普攻 +5。",
    maxStack: 1,
  },
];
export type ItemId = (typeof ITEMS)[number]["id"];
export type BuildKind = "desk" | "lantern" | "barrier" | "turret";
export const RECIPES: {
  id: BuildKind;
  name: string;
  description: string;
  cost: Record<string, number>;
  width: number;
  depth: number;
  health: number;
  color: string;
}[] = [
  {
    id: "desk",
    name: "自習工作臺",
    description: "靠近時緩慢恢復生命與專注。",
    cost: { notes: 5, parts: 4 },
    width: 2.6,
    depth: 1.6,
    health: 180,
    color: "#b78f68",
  },
  {
    id: "lantern",
    name: "守夜宮燈",
    description: "照亮基地，減緩附近異象的移動。",
    cost: { notes: 3, parts: 3 },
    width: 1,
    depth: 1,
    health: 120,
    color: "#f0c27d",
  },
  {
    id: "barrier",
    name: "社團路障",
    description: "阻擋異象，承受攻擊保護基地。",
    cost: { parts: 4 },
    width: 3,
    depth: 0.8,
    health: 280,
    color: "#6f9b95",
  },
  {
    id: "turret",
    name: "知識投射器",
    description: "自動攻擊 15 公尺內的異象。",
    cost: { notes: 8, parts: 7, credit: 1 },
    width: 1.6,
    depth: 1.6,
    health: 160,
    color: "#78bbce",
  },
];
export const ENEMY_TYPES = {
  quiz: {
    name: "突擊小考",
    hp: 65,
    damage: 9,
    speed: 2.1,
    xp: 24,
    color: "#be637f",
    radius: 0.75,
    windup: 0.9,
    reward: { notes: 3, parts: 2 },
  },
  report: {
    name: "分組報告聚合體",
    hp: 145,
    damage: 16,
    speed: 1.55,
    xp: 55,
    color: "#8676c4",
    radius: 1.1,
    windup: 1.2,
    reward: { notes: 5, parts: 4, credit: 1 },
  },
  exam: {
    name: "期中考監視者",
    hp: 240,
    damage: 22,
    speed: 1.4,
    xp: 95,
    color: "#d9a05a",
    radius: 1.3,
    windup: 1.4,
    reward: { notes: 8, parts: 5, credit: 2 },
  },
  final: {
    name: "期末 · 截止日",
    hp: 520,
    damage: 28,
    speed: 1.65,
    xp: 220,
    color: "#b95056",
    radius: 1.8,
    windup: 1.6,
    reward: { notes: 12, parts: 10, credit: 5, badge: 1 },
  },
} as const;
export type EnemyKind = keyof typeof ENEMY_TYPES;
export const ENCOUNTERS: {
  id: string;
  kind: EnemyKind;
  x: number;
  z: number;
}[] = [
  { id: "quiz-1", kind: "quiz", x: -5, z: -48 },
  { id: "quiz-2", kind: "quiz", x: 5, z: -104 },
  { id: "report-1", kind: "report", x: -4, z: -165 },
  { id: "quiz-3", kind: "quiz", x: 7, z: -208 },
  { id: "exam-1", kind: "exam", x: -7, z: -241 },
  { id: "report-2", kind: "report", x: 83, z: -174 },
  { id: "quiz-4", kind: "quiz", x: 124, z: -108 },
  { id: "exam-2", kind: "exam", x: 65, z: -70 },
  { id: "final-1", kind: "final", x: -55, z: -307 },
];
for (const [i, site] of CAMPUS_SITES.filter((s) => s.x > 200 && !s.form)
  .filter((_, i) => i % 2 === 0)
  .entries()) {
  const door = siteEntrance(site),
    x = [195, 331, 390, 490].sort(
      (a, b) => Math.abs(a - door.x) - Math.abs(b - door.x),
    )[0];
  ENCOUNTERS.push({
    id: "campus-" + site.id,
    kind: (["quiz", "report", "exam"] as const)[i % 3],
    x,
    z: door.z + 8,
  });
}
export const MISSIONS = [
  {
    id: "first",
    name: "第一堂異象課",
    description: "擊退 3 隻異象",
    target: 3,
    metric: "kills",
    reward: { coffee: 3, parts: 8 },
    xp: 60,
  },
  {
    id: "builder",
    name: "社團基地成立",
    description: "建造 3 座設施",
    target: 3,
    metric: "built",
    reward: { credit: 2, notes: 10 },
    xp: 75,
  },
  {
    id: "explorer",
    name: "五虎崗踏查",
    description: "發現 8 個校園區域",
    target: 8,
    metric: "discoveries",
    reward: { coffee: 4, tea: 4 },
    xp: 90,
  },
  {
    id: "semester",
    name: "完成這個學期",
    description: "擊敗「期末 · 截止日」",
    target: 1,
    metric: "boss",
    reward: { credit: 5, badge: 1 },
    xp: 200,
  },
] as const;
