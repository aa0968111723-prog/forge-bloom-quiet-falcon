import { campusAudio } from "../audio";
import { postFxEnabled, quality } from "../quality";
import { SAVE_DEFAULTS } from "../save";
import { useGame } from "../store";
import { TIME_PRESETS, type TimeOfDay } from "../world-data/lighting";
import { saveLabel } from "./status";
import { useRpg } from "./store";
import { closeVictory } from "./victory";

export const SETTINGS_LABELS = ["時光", "畫質", "音訊", "操作", "存檔"] as const;

export type SettingsAction =
  | "time"
  | "tier"
  | "post"
  | "volume"
  | "export"
  | "import"
  | "return";

export type SettingsChoice = {
  id: string;
  label: string;
  selected: boolean;
  isDefault: boolean;
  action: SettingsAction;
};

export type SettingsSection = {
  label: (typeof SETTINGS_LABELS)[number];
  choices: SettingsChoice[];
  status: string | null;
  note: string | null;
};

export type SettingsSnap = {
  phase: string;
  timeOfDay: TimeOfDay;
  tier: "auto" | "high" | "low";
  postFx: boolean;
  muted: boolean;
  saved: string;
  panel: string | null;
  plaqueId: string | null;
  saveConflict: boolean;
  victory: boolean;
  settingsOpen: boolean;
};

const TIERS = [
  ["auto", "自動"],
  ["high", "細緻"],
  ["low", "省電"],
] as const;

const POST = [
  ["on", "開"],
  ["off", "關"],
] as const;

const VOLUME = [
  ["audible", "有聲"],
  ["silent", "靜音"],
] as const;

export function settingsSnap(): SettingsSnap {
  const game = useGame.getState();
  const rpg = useRpg.getState();
  return {
    phase: game.phase,
    timeOfDay: game.timeOfDay,
    tier: game.graphics.tier,
    postFx: game.graphics.postFx,
    muted: game.muted,
    saved: rpg.saved,
    panel: rpg.panel,
    plaqueId: game.plaqueId,
    saveConflict: rpg.saveConflict,
    victory: rpg.boss > 0 && !rpg.claimed.includes("semester"),
    settingsOpen: game.settingsOpen,
  };
}

/** The one modal in front. Settings never share the screen with another dialog. */
export function frontModal(
  snap: SettingsSnap = settingsSnap(),
): "settings" | "panel" | "plaque" | "victory" | "save" | null {
  if (snap.saveConflict) return "save";
  if (snap.victory) return "victory";
  if (snap.panel) return "panel";
  if (snap.plaqueId) return "plaque";
  if (snap.settingsOpen || (snap.phase !== "title" && snap.phase === "paused"))
    return "settings";
  return null;
}

export function settingsVisible(snap: SettingsSnap = settingsSnap()) {
  return frontModal(snap) === "settings";
}

export function settingsReturnLabel(phase: string) {
  return phase === "title" ? "返回標題" : "返回遊戲";
}

export function settingsSurface(snap: SettingsSnap = settingsSnap()): {
  sections: SettingsSection[];
  returnLabel: string;
} {
  const time: SettingsChoice[] = (
    Object.entries(TIME_PRESETS) as [TimeOfDay, { label: string }][]
  ).map(([id, preset]) => ({
    id,
    label: preset.label,
    selected: snap.timeOfDay === id,
    isDefault: id === SAVE_DEFAULTS.timeOfDay,
    action: "time",
  }));
  const tiers: SettingsChoice[] = TIERS.map(([id, label]) => ({
    id,
    label,
    selected: snap.tier === id,
    isDefault: id === SAVE_DEFAULTS.graphics.tier,
    action: "tier",
  }));
  const post: SettingsChoice[] = POST.map(([id, label]) => ({
    id,
    label: "光影後製 · " + label,
    selected: snap.postFx === (id === "on"),
    isDefault: (id === "on") === SAVE_DEFAULTS.graphics.postFx,
    action: "post",
  }));
  const volume: SettingsChoice[] = VOLUME.map(([id, label]) => ({
    id,
    label,
    selected: snap.muted === (id === "silent"),
    isDefault: (id === "audible") === !SAVE_DEFAULTS.muted,
    action: "volume",
  }));
  return {
    returnLabel: settingsReturnLabel(snap.phase),
    sections: [
      { label: "時光", choices: time, status: null, note: null },
      {
        label: "畫質",
        choices: [...tiers, ...post],
        status: null,
        note: null,
      },
      { label: "音訊", choices: volume, status: null, note: null },
      {
        label: "操作",
        choices: [],
        status: null,
        note: "鍵鼠用按鍵移動與視角。手機用畫面上的搖桿和按鈕調整畫質、音量、匯出與返回，不需要實體鍵。",
      },
      {
        label: "存檔",
        choices: [
          {
            id: "export",
            label: "匯出存檔",
            selected: false,
            isDefault: false,
            action: "export",
          },
          {
            id: "import",
            label: "匯入存檔",
            selected: false,
            isDefault: false,
            action: "import",
          },
        ],
        status: saveLabel(snap.saved),
        note: "此線上版本自動保存於目前瀏覽器。可匯出存檔，備份或移到其他裝置。",
      },
    ],
  };
}

/** Close every other dialog, then show settings. Play pauses. The title stays. */
export function openSettings() {
  const rpg = useRpg.getState();
  const victory = rpg.boss > 0 && !rpg.claimed.includes("semester");
  useGame.setState({ settingsOpen: true });
  if (rpg.saveConflict) rpg.keepProgress();
  if (rpg.panel) useRpg.setState({ panel: null });
  if (useGame.getState().plaqueId) useGame.getState().openPlaque(null);
  if (victory) closeVictory();
  if (useGame.getState().phase === "playing") useGame.getState().pause();
}

/** Title returns to the title. Play returns to the game. */
export function returnFromSettings() {
  const phase = useGame.getState().phase;
  if (phase === "title") {
    useGame.setState({ settingsOpen: false });
    return;
  }
  useGame.getState().resume();
}

export function graphicsLive() {
  return { tier: quality().tier, postFx: postFxEnabled() };
}

export function volumeLive() {
  return campusAudio.muted;
}

/** The button action. Selection and the live effect update together. */
export function applySettings(action: SettingsAction, id = "") {
  if (action === "time") useGame.getState().setTime(id as TimeOfDay);
  if (action === "tier")
    useGame.getState().setGraphics({ tier: id as "auto" | "high" | "low" });
  if (action === "post")
    useGame.getState().setGraphics({ postFx: id === "on" });
  if (action === "volume") {
    const muted = id === "silent";
    if (useGame.getState().muted !== muted) useGame.getState().toggleMute();
    campusAudio.setMuted(useGame.getState().muted);
  }
  if (action === "export") useRpg.getState().exportSave();
  if (action === "return") returnFromSettings();
}
