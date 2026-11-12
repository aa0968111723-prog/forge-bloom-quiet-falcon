/** The four phrases on the dolphin plinth. The first pair used to be the whole sign. */
export const DOLPHIN_MOTTO = ["立足淡江，放眼世界", "掌握資訊，開創未來"] as const;

export function dolphinMottoText() {
  return DOLPHIN_MOTTO.join("\n");
}
