/**
 * Title readout from a fresh read of the RPG save.
 * The boot read runs once and folds a bad file into an empty semester.
 * The title asks again so each storage state can show its own action.
 */
import { CHROME_CONTROLS } from "./chrome";
import { DEPARTMENTS } from "./data";
import { progressReadout } from "./status";
import { decodeSave, RPG_SAVE_KEY, useRpg } from "./store";
import { useGame } from "../store";

export const HOME_FILE_ERROR = "檔案錯誤：這份存檔無法讀取。";
export const HOME_STORAGE_LIMIT = "儲存限制：瀏覽器無法寫入存檔。";

export type HomeKind = "empty" | "progress" | "file" | "storage";

export type HomeReadout = {
  kind: HomeKind;
  primary: string;
  major: string | null;
  progress: string | null;
  summary: string | null;
  fileError: string | null;
  storageLimit: string | null;
  importLabel: string;
  exportLabel: string;
};

const IMPORT_LABEL = "匯入存檔";
const EXPORT_LABEL = "匯出存檔";

function readout(
  kind: HomeKind,
  detail?: { major: string; progress: string; summary: string },
): HomeReadout {
  return {
    kind,
    primary:
      kind === "progress"
        ? CHROME_CONTROLS.continueSemester
        : CHROME_CONTROLS.startSemester,
    major: detail?.major ?? null,
    progress: detail?.progress ?? null,
    summary: detail?.summary ?? null,
    fileError: kind === "file" ? HOME_FILE_ERROR : null,
    storageLimit: kind === "storage" ? HOME_STORAGE_LIMIT : null,
    importLabel: IMPORT_LABEL,
    exportLabel: EXPORT_LABEL,
  };
}

function readStored(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(RPG_SAVE_KEY);
}

/** Probe the RPG key itself. A quota writer that ignores other keys still counts. */
function storageAcceptsWrites(current: string | null) {
  localStorage.setItem(RPG_SAVE_KEY, current ?? "");
  if (current === null) localStorage.removeItem(RPG_SAVE_KEY);
}

export function readHome(): HomeReadout {
  let current: string | null;
  try {
    current = readStored();
  } catch {
    return readout("storage");
  }
  try {
    storageAcceptsWrites(current);
  } catch {
    return readout("storage");
  }
  if (!current) return readout("empty");
  try {
    const raw = decodeSave(current);
    const department = DEPARTMENTS.find((item) => item.id === raw.departmentId);
    if (!department) return readout("empty");
    const xp = typeof raw.xp === "number" && Number.isFinite(raw.xp) ? raw.xp : 0;
    const bar = progressReadout({ xp });
    return readout("progress", {
      major: department.name,
      progress: bar.line,
      summary: `最近存檔：${department.name}，等級 ${bar.level}`,
    });
  } catch {
    return readout("file");
  }
}

/** Resume only a readable semester. A missing or bad file stays on the title. */
export function enterHome() {
  const home = readHome();
  if (home.kind === "progress") {
    let text: string | null = null;
    try {
      text = readStored();
    } catch {
      text = null;
    }
    if (text && useRpg.getState().importSave(text)) {
      useRpg.setState({ notice: "", incomingSave: null });
      // Import stands an indoor file at the door and rewrites the save.
      // A living continue still uses the file the player just confirmed.
      const alive = useRpg.getState().hp > 0;
      useRpg.getState().continueGame(alive ? text : undefined);
    }
    return;
  }
  useGame.setState({ phase: "title", settingsOpen: false });
  const rpg = useRpg.getState();
  useRpg.setState({
    lessonReview: false,
    ...(rpg.lesson === "done" ? {} : { lesson: "department" as const, lessonAnchor: null }),
    ...(rpg.departmentId ? { departmentId: null, freshStart: true } : {}),
  });
  useRpg.getState().setPanel("department");
}

export function stageImport(text: string): "confirm" | "direct" {
  let current: string | null;
  try {
    current = readStored();
  } catch {
    current = "";
  }
  if (current !== null) {
    useRpg.setState({ incomingSave: text });
    useGame.setState({ settingsOpen: false });
    return "confirm";
  }
  return "direct";
}

export function confirmImport(): boolean {
  const text = useRpg.getState().incomingSave;
  useRpg.setState({ incomingSave: null });
  if (text === null) return false;
  return useRpg.getState().importSave(text);
}

export function cancelImport() {
  useRpg.setState({ incomingSave: null });
}

function downloadText(text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tamkang-world-save.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download the stored file when one exists, without rewriting it from memory. */
export function exportHomeBackup(): string {
  let stored: string | null = null;
  try {
    stored = readStored();
  } catch {
    stored = null;
  }
  if (stored !== null) {
    try {
      downloadText(stored);
    } catch {
      /* The string is the backup even when the browser blocks the download. */
    }
    return stored;
  }
  try {
    useRpg.getState().exportSave();
  } catch {
    /* The write may already have landed before the download failed. */
  }
  try {
    return readStored() ?? "";
  } catch {
    return "";
  }
}
