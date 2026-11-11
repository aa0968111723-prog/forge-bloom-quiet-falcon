/**
 * Tamkang University colleges and a representative set of real departments.
 *
 * Skill modifiers are numeric — they change combat damage, max HP, heal,
 * inventory capacity or building range. Flavor text lives in `blurb` only.
 */

export const COLLEGE_IDS = [
  "liberal-arts",
  "science",
  "engineering",
  "business",
  "foreign-lang",
  "international",
  "education",
  "ai",
  "precision-health",
] as const;

export type CollegeId = (typeof COLLEGE_IDS)[number];

export type College = {
  id: CollegeId;
  name: string;
  nameEn: string;
};

export const COLLEGES: College[] = [
  { id: "liberal-arts", name: "文學院", nameEn: "College of Liberal Arts" },
  { id: "science", name: "理學院", nameEn: "College of Science" },
  { id: "engineering", name: "工學院", nameEn: "College of Engineering" },
  { id: "business", name: "商管學院", nameEn: "College of Business and Management" },
  { id: "foreign-lang", name: "外國語文學院", nameEn: "College of Foreign Languages and Literatures" },
  { id: "international", name: "國際事務學院", nameEn: "College of International Affairs" },
  { id: "education", name: "教育學院", nameEn: "College of Education" },
  { id: "ai", name: "AI創智學院", nameEn: "College of Artificial Intelligent Innovation" },
  { id: "precision-health", name: "精準健康學院", nameEn: "College of Precision Healthcare" },
];

export type Department = {
  id: string;
  name: string;
  nameEn: string;
  collegeId: CollegeId;
  blurb: string;
};

export const DEPARTMENTS: Department[] = [
  {
    id: "chi-lit",
    name: "中國文學學系",
    nameEn: "Department of Chinese Literature",
    collegeId: "liberal-arts",
    blurb: "報告傷害較高，文思如潮。",
  },
  {
    id: "mass-comm",
    name: "大眾傳播學系",
    nameEn: "Department of Mass Communication",
    collegeId: "liberal-arts",
    blurb: "報告傷害較高，擅長把故事講清楚。",
  },
  {
    id: "math",
    name: "數學系",
    nameEn: "Department of Mathematics",
    collegeId: "science",
    blurb: "考試傷害較高，推導比猜題快。",
  },
  {
    id: "physics",
    name: "物理學系",
    nameEn: "Department of Physics",
    collegeId: "science",
    blurb: "考試傷害較高，公式就是武器。",
  },
  {
    id: "chemistry",
    name: "化學系",
    nameEn: "Department of Chemistry",
    collegeId: "science",
    blurb: "考試傷害較高，滴定比死背穩。",
  },
  {
    id: "architecture",
    name: "建築學系",
    nameEn: "Department of Architecture",
    collegeId: "engineering",
    blurb: "背包較大，建造距離較遠。",
  },
  {
    id: "civil",
    name: "土木工程學系",
    nameEn: "Department of Civil Engineering",
    collegeId: "engineering",
    blurb: "背包較大，建造距離較遠。",
  },
  {
    id: "cs",
    name: "資訊工程學系",
    nameEn: "Department of Computer Science and Information Engineering",
    collegeId: "engineering",
    blurb: "背包較大，建造距離較遠。",
  },
  {
    id: "ee",
    name: "電機工程學系",
    nameEn: "Department of Electrical and Computer Engineering",
    collegeId: "engineering",
    blurb: "背包較大，建造距離較遠。",
  },
  {
    id: "ba",
    name: "企業管理學系",
    nameEn: "Department of Business Administration",
    collegeId: "business",
    blurb: "背包與建造距離都加一點。",
  },
  {
    id: "accounting",
    name: "會計學系",
    nameEn: "Department of Accounting",
    collegeId: "business",
    blurb: "背包與建造距離都加一點。",
  },
  {
    id: "mis",
    name: "資訊管理學系",
    nameEn: "Department of Information Management",
    collegeId: "business",
    blurb: "背包與建造距離都加一點。",
  },
  {
    id: "english",
    name: "英文學系",
    nameEn: "Department of English",
    collegeId: "foreign-lang",
    blurb: "防禦與體力較高。",
  },
  {
    id: "japanese",
    name: "日本語文學系",
    nameEn: "Department of Japanese",
    collegeId: "foreign-lang",
    blurb: "防禦與體力較高。",
  },
  {
    id: "diplomacy",
    name: "外交與國際關係學系",
    nameEn: "Department of Diplomacy and International Relations",
    collegeId: "international",
    blurb: "攻擊與防禦都加一點。",
  },
  {
    id: "tourism",
    name: "國際觀光管理學系",
    nameEn: "Department of International Tourism Management",
    collegeId: "international",
    blurb: "攻擊與防禦都加一點。",
  },
  {
    id: "ed-tech",
    name: "教育科技學系",
    nameEn: "Department of Educational Technology",
    collegeId: "education",
    blurb: "體力較高，使用物品回血較多。",
  },
  {
    id: "ai",
    name: "人工智慧學系",
    nameEn: "Department of Artificial Intelligence",
    collegeId: "ai",
    blurb: "異象傷害較高。",
  },
  {
    id: "med-info",
    name: "醫學資訊與創新應用學士學位學程",
    nameEn: "Bachelor's Program in Medical Informatics and Innovative Applications",
    collegeId: "precision-health",
    blurb: "回血與體力都較高。",
  },
];

export const DEPARTMENT_BY_ID: Record<string, Department> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.id, d]),
);

export const COLLEGE_BY_ID: Record<CollegeId, College> = Object.fromEntries(
  COLLEGES.map((c) => [c.id, c]),
) as Record<CollegeId, College>;

export function departmentById(id: string | null | undefined): Department | null {
  if (!id) return null;
  return DEPARTMENT_BY_ID[id] ?? null;
}

export function coerceDepartmentId(value: unknown): string | null {
  return typeof value === "string" && DEPARTMENT_BY_ID[value] ? value : null;
}

export type SkillModifiers = {
  inventoryCapacityBonus: number;
  attackBonus: number;
  examAttackBonus: number;
  reportAttackBonus: number;
  anomalyAttackBonus: number;
  defenseBonus: number;
  maxHpBonus: number;
  buildRangeBonus: number;
  healOnUse: number;
};

export const ZERO_MODIFIERS: SkillModifiers = {
  inventoryCapacityBonus: 0,
  attackBonus: 0,
  examAttackBonus: 0,
  reportAttackBonus: 0,
  anomalyAttackBonus: 0,
  defenseBonus: 0,
  maxHpBonus: 0,
  buildRangeBonus: 0,
  healOnUse: 0,
};

const COLLEGE_MODS: Record<CollegeId, SkillModifiers> = {
  "liberal-arts": { ...ZERO_MODIFIERS, reportAttackBonus: 3, attackBonus: 1 },
  science: { ...ZERO_MODIFIERS, examAttackBonus: 3 },
  engineering: { ...ZERO_MODIFIERS, inventoryCapacityBonus: 4, buildRangeBonus: 1.5, attackBonus: 1 },
  business: { ...ZERO_MODIFIERS, inventoryCapacityBonus: 2, buildRangeBonus: 2 },
  "foreign-lang": { ...ZERO_MODIFIERS, defenseBonus: 2, maxHpBonus: 4 },
  international: { ...ZERO_MODIFIERS, attackBonus: 2, defenseBonus: 1 },
  education: { ...ZERO_MODIFIERS, maxHpBonus: 8, healOnUse: 2 },
  ai: { ...ZERO_MODIFIERS, anomalyAttackBonus: 3, examAttackBonus: 1 },
  "precision-health": { ...ZERO_MODIFIERS, healOnUse: 6, maxHpBonus: 6 },
};

export function skillModifiers(departmentId: string | null | undefined): SkillModifiers {
  const dept = departmentById(departmentId ?? null);
  if (!dept) return { ...ZERO_MODIFIERS };
  return { ...COLLEGE_MODS[dept.collegeId] };
}

export function inventoryCapacityFor(departmentId: string | null | undefined, base = 12): number {
  return base + skillModifiers(departmentId).inventoryCapacityBonus;
}

export function departmentsInCollege(collegeId: CollegeId): Department[] {
  return DEPARTMENTS.filter((d) => d.collegeId === collegeId);
}
