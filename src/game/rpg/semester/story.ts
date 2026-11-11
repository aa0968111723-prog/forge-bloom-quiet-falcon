import { ITEMS, MISSIONS } from "../data.ts";
import { BAG_CAPACITY, intakePreview } from "../prompts.ts";

export const STORY_SAVE_KEY = "tamkang-rpg-v2";
export const STORY_SAVE_VERSION = 2;
export const BAG_SLOTS = BAG_CAPACITY;

export const CHAPTERS = [
  { id: "opening", name: "開學", order: 0, gate: "victory-opening" },
  { id: "investigate", name: "調查", order: 1, gate: "victory-investigate" },
  { id: "report", name: "報告", order: 2, gate: "victory-report" },
  { id: "final", name: "期末", order: 3, gate: "boss" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

export const SIDE_IDS = ["side-explore", "side-build", "side-campus"] as const;
export type SideId = (typeof SIDE_IDS)[number];
export type SideStatus = "available" | "active" | "ready" | "claimed";

export type BagSlot = { itemId: string; quantity: number };
export type OverflowDrop = {
  id: string;
  x: number;
  z: number;
  items: Record<string, number>;
  eventId: string;
};

export type RewardHost = {
  xp: number;
  /** Present key means this id already settled, even when the stored xp is 0. */
  granted: Record<string, number>;
};

const MISSION_XP: Record<string, number> = {
  "victory-opening": MISSIONS.find((row) => row.id === "first")?.xp ?? 0,
  "victory-investigate": MISSIONS.find((row) => row.id === "explorer")?.xp ?? 0,
  "victory-report": MISSIONS.find((row) => row.id === "builder")?.xp ?? 0,
  boss: MISSIONS.find((row) => row.id === "semester")?.xp ?? 0,
  "side-explore": 30,
  "side-build": 30,
  "side-campus": 30,
};

const SIDE_REWARD: Record<SideId, Record<string, number>> = {
  "side-explore": { coffee: 2 },
  "side-build": { parts: 4 },
  "side-campus": { tea: 2, credit: 1 },
};

export type StoryState = RewardHost & {
  chapterIndex: number;
  bossVictory: boolean;
  sides: Record<SideId, SideStatus>;
  claimedSides: SideId[];
  claimedMissions: string[];
  bag: BagSlot[];
  overflow: OverflowDrop[];
};

export function createStory(): StoryState {
  return {
    chapterIndex: 0,
    xp: 0,
    granted: {},
    bossVictory: false,
    sides: {
      "side-explore": "available",
      "side-build": "available",
      "side-campus": "available",
    },
    claimedSides: [],
    claimedMissions: [],
    bag: [],
    overflow: [],
  };
}

export function xpForQuest(eventId: string): number {
  return MISSION_XP[eventId] ?? 0;
}

/**
 * One id settles once on this save.
 * Wiring later replaces the xp add with growth `grantXp`.
 */
export function grantQuestReward(eventId: string, host: RewardHost): boolean {
  if (Object.prototype.hasOwnProperty.call(host.granted, eventId)) return false;
  const xp = xpForQuest(eventId);
  host.granted[eventId] = xp;
  host.xp += xp;
  return true;
}

/** Old progress is already paid. Mark the id without paying it again. */
export function seedQuestReward(eventId: string, host: RewardHost) {
  if (Object.prototype.hasOwnProperty.call(host.granted, eventId)) return;
  host.granted[eventId] = 0;
}

export function activateSide(story: StoryState, id: SideId): boolean {
  if (story.sides[id] !== "available") return false;
  story.sides[id] = "active";
  return true;
}

export function readySide(story: StoryState, id: SideId): boolean {
  if (story.sides[id] !== "active") return false;
  story.sides[id] = "ready";
  return true;
}

function applyAccepted(bag: readonly BagSlot[], accepted: Record<string, number>): BagSlot[] {
  const next = bag.map((slot) => ({ itemId: slot.itemId, quantity: slot.quantity }));
  for (const [id, amount] of Object.entries(accepted)) {
    let remaining = amount;
    const maxStack = ITEMS.find((item) => item.id === id)?.maxStack ?? 99;
    for (const slot of next) {
      if (remaining === 0) break;
      if (slot.itemId !== id || slot.quantity >= maxStack) continue;
      const take = Math.min(maxStack - slot.quantity, remaining);
      slot.quantity += take;
      remaining -= take;
    }
    while (remaining > 0 && next.length < BAG_CAPACITY) {
      const take = Math.min(maxStack, remaining);
      next.push({ itemId: id, quantity: take });
      remaining -= take;
    }
  }
  return next;
}

/**
 * Claim a ready side once. A full bag (24) spills the rest onto one ground pile.
 * The quest id is not paid twice.
 */
export function claimSide(
  story: StoryState,
  id: SideId,
  at: { x: number; z: number },
): { ok: boolean; overflow: OverflowDrop | null } {
  if (story.sides[id] !== "ready") return { ok: false, overflow: null };
  const reward = SIDE_REWARD[id];
  const preview = intakePreview(story.bag, BAG_CAPACITY, reward);
  story.bag = applyAccepted(story.bag, preview.accepted);
  let overflow: OverflowDrop | null = null;
  if (Object.keys(preview.left).length > 0) {
    overflow = {
      id: `overflow-${id}`,
      x: at.x,
      z: at.z,
      items: preview.left,
      eventId: id,
    };
    story.overflow.push(overflow);
  }
  story.sides[id] = "claimed";
  if (!story.claimedSides.includes(id)) story.claimedSides.push(id);
  grantQuestReward(id, story);
  return { ok: true, overflow };
}

export type AdvanceResult = { ok: boolean; reason: "need-victory" | "end" | null };

function gateSettled(story: StoryState, gate: string) {
  if (gate === "boss") return story.bossVictory || Object.prototype.hasOwnProperty.call(story.granted, "boss");
  return Object.prototype.hasOwnProperty.call(story.granted, gate);
}

/** Move one chapter. Refuses when that chapter's victory has not settled. */
export function advanceChapter(story: StoryState): AdvanceResult {
  const current = CHAPTERS[story.chapterIndex];
  const next = CHAPTERS[story.chapterIndex + 1];
  if (!current || !next) return { ok: false, reason: "end" };
  if (!gateSettled(story, current.gate)) return { ok: false, reason: "need-victory" };
  story.chapterIndex += 1;
  return { ok: true, reason: null };
}

/** Victory flag for one event id. A second call does not pay or flip again. */
export function markVictory(story: StoryState, eventId: string): boolean {
  if (Object.prototype.hasOwnProperty.call(story.granted, eventId)) return false;
  const paid = grantQuestReward(eventId, story);
  if (eventId === "boss") story.bossVictory = true;
  return paid;
}

export function storyPins(story: StoryState): string[] {
  const chapter = CHAPTERS[story.chapterIndex] ?? CHAPTERS[0];
  const pins = [`chapter:${chapter.id}`];
  for (const id of SIDE_IDS) {
    const status = story.sides[id];
    if (status === "active" || status === "ready") pins.push(id);
  }
  if (story.bossVictory) pins.push("boss:defeated");
  return pins;
}

function isSide(id: unknown): id is SideId {
  return id === "side-explore" || id === "side-build" || id === "side-campus";
}

export type V2Story = {
  key: typeof STORY_SAVE_KEY;
  version: 2;
  usable: boolean;
  claimedSides: SideId[];
  claimedMissions: string[];
  bossVictory: boolean;
  chapterIndex: number;
  appearanceId: string | null;
};

/**
 * Version 2 story flags.
 * A missing boss or claimed field is not a victory and not a claimed side.
 * `boss: 1` and known side ids from an older snapshot are kept.
 */
export function readV2Story(raw: unknown): V2Story {
  const empty: V2Story = {
    key: STORY_SAVE_KEY,
    version: 2,
    usable: false,
    claimedSides: [],
    claimedMissions: [],
    bossVictory: false,
    chapterIndex: 0,
    appearanceId: null,
  };
  if (!raw || typeof raw !== "object") return empty;
  const record = raw as Record<string, unknown>;
  if ("version" in record && record.version !== 2) return empty;
  const story =
    record.story && typeof record.story === "object"
      ? (record.story as Record<string, unknown>)
      : null;
  const claimed = new Set<SideId>();
  const missions = new Set<string>();
  const missionIds = new Set<string>(MISSIONS.map((row) => row.id));
  const takeClaimed = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const id of value) {
      if (isSide(id)) claimed.add(id);
      else if (typeof id === "string" && missionIds.has(id)) missions.add(id);
    }
  };
  takeClaimed(record.claimed);
  if (story) takeClaimed(story.claimedSides);
  let bossVictory = false;
  if (typeof record.boss === "number" && Number.isFinite(record.boss) && record.boss > 0) {
    bossVictory = true;
  }
  if (story?.bossVictory === true) bossVictory = true;
  const chapterSource = story?.chapterIndex ?? record.chapterIndex;
  let chapterIndex = 0;
  if (typeof chapterSource === "number" && Number.isInteger(chapterSource)) {
    chapterIndex = Math.min(CHAPTERS.length - 1, Math.max(0, chapterSource));
  } else if (bossVictory) {
    chapterIndex = CHAPTERS.length - 1;
  }
  const appearanceSource = story?.appearanceId ?? record.appearanceId;
  const appearanceId = typeof appearanceSource === "string" ? appearanceSource : null;
  return {
    key: STORY_SAVE_KEY,
    version: 2,
    usable: true,
    claimedSides: [...claimed],
    claimedMissions: [...missions],
    bossVictory,
    chapterIndex,
    appearanceId,
  };
}

export function applyV2Story(story: StoryState, raw: unknown): V2Story {
  const read = readV2Story(raw);
  if (!read.usable) return read;
  story.chapterIndex = read.chapterIndex;
  story.bossVictory = read.bossVictory;
  story.claimedMissions = [...read.claimedMissions];
  for (const id of read.claimedSides) {
    story.sides[id] = "claimed";
    if (!story.claimedSides.includes(id)) story.claimedSides.push(id);
    seedQuestReward(id, story);
  }
  if (read.bossVictory) seedQuestReward("boss", story);
  for (const id of read.claimedMissions) seedQuestReward(id, story);
  return read;
}
