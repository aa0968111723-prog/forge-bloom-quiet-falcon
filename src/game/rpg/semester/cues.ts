/** Combat feedback. Low-motion mode still reads the words; color is only extra. */
export const COMBAT_CUES = {
  hit: { id: "hit", text: "命中", color: "#d9a05a" },
  miss: { id: "miss", text: "落空", color: "#8aa0b2" },
  blocked: { id: "blocked", text: "遮擋", color: "#6f9b95" },
  immune: { id: "immune", text: "免疫", color: "#9cbde7" },
  windup: { id: "windup", text: "蓄力", color: "#be637f" },
} as const;

export type CombatCueId = keyof typeof COMBAT_CUES;

/** Reduced motion keeps a sentence. It never falls back to a swatch alone. */
export function cueLine(id: CombatCueId, lowMotion: boolean): string {
  const cue = COMBAT_CUES[id];
  return lowMotion ? `文字提示：${cue.text}` : cue.text;
}
