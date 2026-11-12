import {
  DEPARTMENTS as CATALOG,
  departmentById,
  skillModifiers,
  type CollegeId,
  type SkillModifiers,
} from "../departments.ts";
import { DEPARTMENTS as RPG, type Discipline } from "../rpg/data.ts";

/**
 * One lookup for the two department lists.
 * Saves keep the RPG id (`science-理學院-2`). Narrative and skill modifiers keep the short id (`chemistry`).
 * Names that differ between the lists are aliases, not a third catalog.
 */
const NAME_ALIAS: Record<string, string> = {
  數學系: "應用數學與數據科學學系",
  應用數學與數據科學學系: "數學系",
  化學系: "化學學系",
  化學學系: "化學系",
};

export type DepartmentLink = {
  /** RPG id when one exists. Otherwise the short catalog id. */
  canonicalId: string;
  rpgId: string | null;
  catalogId: string | null;
  name: string;
  discipline: Discipline | null;
  collegeId: CollegeId | null;
  collegeName: string;
};

function namesOf(name: string) {
  const alias = NAME_ALIAS[name];
  return alias ? [name, alias] : [name];
}

function matchesName(name: string, candidate: string) {
  return namesOf(name).includes(candidate);
}

export function resolveDepartment(id: string | null | undefined): DepartmentLink | null {
  if (!id) return null;
  const rpgDirect = RPG.find((row) => row.id === id) ?? null;
  const catalogDirect = departmentById(id);
  const rpg =
    rpgDirect ??
    RPG.find((row) => matchesName(id, row.name)) ??
    (catalogDirect ? RPG.find((row) => matchesName(catalogDirect.name, row.name)) : undefined) ??
    null;
  const catalog =
    catalogDirect ??
    CATALOG.find((row) => matchesName(id, row.name)) ??
    (rpg ? CATALOG.find((row) => matchesName(rpg.name, row.name)) : undefined) ??
    null;
  if (!rpg && !catalog) return null;
  return {
    canonicalId: rpg?.id ?? catalog!.id,
    rpgId: rpg?.id ?? null,
    catalogId: catalog?.id ?? null,
    name: rpg?.name ?? catalog!.name,
    discipline: rpg?.discipline ?? null,
    collegeId: catalog?.collegeId ?? null,
    collegeName: rpg?.college ?? "",
  };
}

export function catalogIdFor(id: string | null | undefined): string | null {
  return resolveDepartment(id)?.catalogId ?? null;
}

export function rpgIdFor(id: string | null | undefined): string | null {
  return resolveDepartment(id)?.rpgId ?? null;
}

export function abilityQuery(id: string | null | undefined): {
  link: DepartmentLink;
  modifiers: SkillModifiers;
} | null {
  const link = resolveDepartment(id);
  if (!link) return null;
  return { link, modifiers: skillModifiers(link.catalogId) };
}
