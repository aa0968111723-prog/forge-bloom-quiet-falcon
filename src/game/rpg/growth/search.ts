import {
  COLLEGE_BY_ID,
  COLLEGE_IDS,
  DEPARTMENTS,
  type CollegeId,
  type Department,
} from "../../departments.ts";

export type DepartmentHit = {
  id: string;
  name: string;
  nameEn: string;
  blurb: string;
  collegeId: CollegeId;
  collegeName: string;
};

export type DepartmentGroup = {
  collegeId: CollegeId;
  collegeName: string;
  count: number;
  departments: DepartmentHit[];
};

export type DepartmentSearch = {
  query: string;
  cleared: boolean;
  count: number;
  empty: boolean;
  emptyMessage: string | null;
  groups: DepartmentGroup[];
  keyboardIds: string[];
  /** Same rows a phone list should render. No viewport branch. */
  touchTargets: { id: string; label: string; collegeId: CollegeId }[];
  inputHint: string;
};

const EMPTY_MESSAGE = "沒有符合的科系，試試其他名稱。";

function haystack(department: Department) {
  const college = COLLEGE_BY_ID[department.collegeId];
  return [department.id, department.name, department.nameEn, department.blurb, college.name, college.nameEn]
    .join("\n")
    .toLowerCase();
}

const INDEX = DEPARTMENTS.map((department) => ({
  department,
  haystack: haystack(department),
}));

function tokensOf(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function toHit(department: Department): DepartmentHit {
  return {
    id: department.id,
    name: department.name,
    nameEn: department.nameEn,
    blurb: department.blurb,
    collegeId: department.collegeId,
    collegeName: COLLEGE_BY_ID[department.collegeId].name,
  };
}

/** Chinese substring, whitespace, clear, count. Groups stay the nine colleges. */
export function searchDepartments(query: string): DepartmentSearch {
  const text = typeof query === "string" ? query : "";
  const tokens = tokensOf(text);
  const matched = INDEX.filter((entry) => tokens.every((token) => entry.haystack.includes(token))).map(
    (entry) => entry.department,
  );
  const groups: DepartmentGroup[] = COLLEGE_IDS.map((collegeId) => {
    const departments = matched.filter((department) => department.collegeId === collegeId).map(toHit);
    return {
      collegeId,
      collegeName: COLLEGE_BY_ID[collegeId].name,
      count: departments.length,
      departments,
    };
  });
  const keyboardIds = groups.flatMap((group) => group.departments.map((department) => department.id));
  const count = keyboardIds.length;
  return {
    query: text.trim(),
    cleared: tokens.length === 0,
    count,
    empty: count === 0,
    emptyMessage: count === 0 ? EMPTY_MESSAGE : null,
    groups,
    keyboardIds,
    touchTargets: keyboardIds.map((id) => {
      const hit = matched.find((department) => department.id === id)!;
      return {
        id,
        label: `${COLLEGE_BY_ID[hit.collegeId].name} ${hit.name}`,
        collegeId: hit.collegeId,
      };
    }),
    inputHint: "搜尋科系",
  };
}

export type DepartmentKey = "ArrowDown" | "ArrowUp" | "Home" | "End" | "Escape" | "next" | "prev";

/** Linear keyboard order. Stops at the ends. Escape only clears the highlight. */
export function departmentKeyNav(
  ids: readonly string[],
  currentId: string | null,
  key: DepartmentKey,
): string | null {
  if (key === "Escape") return null;
  if (!ids.length) return null;
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  const index = currentId ? ids.indexOf(currentId) : -1;
  if (key === "ArrowDown" || key === "next") {
    if (index < 0) return ids[0];
    return ids[Math.min(ids.length - 1, index + 1)];
  }
  if (index < 0) return ids[ids.length - 1];
  return ids[Math.max(0, index - 1)];
}
