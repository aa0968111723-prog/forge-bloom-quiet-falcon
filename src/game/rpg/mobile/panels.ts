import { CHROME_CONTROLS } from "../chrome.ts";

/** Shared adventure panels the mobile shell can host without rewriting their rules. */
export type MobilePanelId =
  | "department"
  | "inventory"
  | "skills"
  | "map"
  | "build"
  | "journal"
  | "settings";

export type MobilePanelSpec = {
  id: MobilePanelId;
  title: string;
  /** Independent scrollport. */
  scrollId: string;
  /** Always-visible close control. */
  closeId: string;
  /** Element to focus after the panel closes. */
  restoreFocusId: string;
  /** Background quickbar and gameplay hotkeys stay inert while the panel is open. */
  blocksQuickbar: true;
};

export const MOBILE_PANELS: readonly MobilePanelSpec[] = [
  {
    id: "department",
    title: "選擇你的主修",
    scrollId: "tk-mobile-scroll-department",
    closeId: "tk-mobile-close-department",
    restoreFocusId: "tk-mobile-open-department",
    blocksQuickbar: true,
  },
  {
    id: "inventory",
    title: CHROME_CONTROLS.inventory,
    scrollId: "tk-mobile-scroll-inventory",
    closeId: "tk-mobile-close-inventory",
    restoreFocusId: "tk-mobile-open-inventory",
    blocksQuickbar: true,
  },
  {
    id: "skills",
    title: CHROME_CONTROLS.skills,
    scrollId: "tk-mobile-scroll-skills",
    closeId: "tk-mobile-close-skills",
    restoreFocusId: "tk-mobile-open-skills",
    blocksQuickbar: true,
  },
  {
    id: "map",
    title: CHROME_CONTROLS.map,
    scrollId: "tk-mobile-scroll-map",
    closeId: "tk-mobile-close-map",
    restoreFocusId: "tk-mobile-open-map",
    blocksQuickbar: true,
  },
  {
    id: "build",
    title: CHROME_CONTROLS.build,
    scrollId: "tk-mobile-scroll-build",
    closeId: "tk-mobile-close-build",
    restoreFocusId: "tk-mobile-open-build",
    blocksQuickbar: true,
  },
  {
    id: "journal",
    title: CHROME_CONTROLS.journal,
    scrollId: "tk-mobile-scroll-journal",
    closeId: "tk-mobile-close-journal",
    restoreFocusId: "tk-mobile-open-journal",
    blocksQuickbar: true,
  },
  {
    id: "settings",
    title: CHROME_CONTROLS.settings,
    scrollId: "tk-mobile-scroll-settings",
    closeId: "tk-mobile-close-settings",
    restoreFocusId: "tk-mobile-open-settings",
    blocksQuickbar: true,
  },
];

export function mobilePanel(id: MobilePanelId): MobilePanelSpec {
  const spec = MOBILE_PANELS.find((panel) => panel.id === id);
  if (!spec) throw new Error("unknown mobile panel");
  return spec;
}

/** Close returns focus to the opener. The shell does not move keyboard focus by itself. */
export function panelClosePlan(id: MobilePanelId): {
  closeId: string;
  scrollId: string;
  restoreFocusId: string;
  blocksQuickbar: true;
} {
  const spec = mobilePanel(id);
  return {
    closeId: spec.closeId,
    scrollId: spec.scrollId,
    restoreFocusId: spec.restoreFocusId,
    blocksQuickbar: true,
  };
}
