import { useGame } from "../store";
import { dialogDepth } from "./dialog";
import { useRpg } from "./store";

/**
 * Victory's own effect cleans up before its dialog child pops this layer.
 * A depth of one is this dialog, not a pause menu still behind it.
 */
export function settleVictoryClose() {
  if (dialogDepth() > 1 || useRpg.getState().panel) return;
  if (useGame.getState().settingsOpen) return;
  const phase = useGame.getState().phase;
  if (phase === "paused" || phase === "codex") useGame.getState().resume();
}

/** Claim the semester and resume before React paints, while this layer is still stacked. */
export function closeVictory() {
  useRpg.getState().claim("semester");
  settleVictoryClose();
}

/** The pause screen that appears when play is paused and no victory dialog remains. */
export function victoryPauseMenuOpen(settings: boolean) {
  const game = useGame.getState();
  const rpg = useRpg.getState();
  const victory = rpg.boss > 0 && !rpg.claimed.includes("semester");
  return settings || (game.phase === "paused" && !rpg.panel && !victory);
}
