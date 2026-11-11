export type NoticeChannel = "life" | "focus" | "xp" | "toast";

/**
 * Meter ticks are not live announcements.
 * A toast is polite and is the only channel that should be read aloud.
 */
export function meterLivePolicy(channel: NoticeChannel): {
  ariaLive: "off" | "polite";
  announce: boolean;
} {
  if (channel === "toast") return { ariaLive: "polite", announce: true };
  return { ariaLive: "off", announce: false };
}
