import { CAMPUS_SITES } from "../../game/rpg/campus.ts";
import type {
  Choice,
  Effect,
  EventRecord,
  Line,
  NpcRecord,
  PlaceRecord,
  QuestRecord,
} from "../narrative/types.ts";
import { FACULTY_BEATS, type BeatSpec } from "./beats.ts";
import { FACULTY_CAST, type FacultyPerson } from "./cast.ts";
import { facultyPosts, type FacultyPost } from "./posts.ts";

/** Cross-character quest. Nodes move only on the beats marked main. */
export const STUDIO_QUEST_ID = "quest-faculty-studio";

const STAGE_XP = { meet: 6, clash: 8, turn: 8, after: 10 } as const;

const MAP_SOURCE = {
  url: "https://classic.tku.edu.tw/doc/CampusMap202103.pdf",
  consulted: "2026-11-12",
  version:
    "檔名 CampusMap202103（2021-03）。本輪沒有重新下載 PDF。站點是門口外推的估計位置，不升為 surveyed。",
  confidence: "inherited-registry" as const,
};

function zh(text: string): { "zh-Hant": string } {
  return { "zh-Hant": text };
}

function siteName(siteId: string): string {
  return CAMPUS_SITES.find((site) => site.id === siteId)?.name ?? siteId;
}

function personQuest(person: FacultyPerson): QuestRecord {
  return {
    id: person.questId,
    title: zh(person.questTitle),
    evidence: "fictional",
    arc: true,
    nodes: (["meet", "clash", "turn", "after"] as const).map((stage, index, stages) => ({
      id: stage,
      requires: index === 0 ? null : stages[index - 1],
      summary: zh(person.nodes[stage]),
    })),
    rewardIds: (["meet", "clash", "turn", "after"] as const).map((stage) => `${person.questId}-${stage}`),
  };
}

function studioQuest(): QuestRecord {
  return {
    id: STUDIO_QUEST_ID,
    title: zh("評圖留白"),
    evidence: "fictional",
    arc: true,
    nodes: [
      { id: "meet", requires: null, summary: zh("在建築系館外認識顧衡，先問缺的線。") },
      { id: "clash", requires: "meet", summary: zh("裂縫留在圖上或另紙，再去問沈酌那一次失敗。") },
      { id: "turn", requires: "clash", summary: zh("邱寧讓評圖和社團都留一格，缺的是誰讓出一小時。") },
      { id: "after", requires: "turn", summary: zh("梁晚只貼已經寫了名字的句子。") },
    ],
    rewardIds: ["meet", "clash", "turn", "after"].map((stage) => `${STUDIO_QUEST_ID}-${stage}`),
  };
}

function effects(post: FacultyPost, beat: BeatSpec, choice: BeatSpec["choices"][number]): Effect[] {
  const list: Effect[] = [
    {
      type: "quest-reward",
      questId: `${post.questId}-${beat.stage}`,
      xp: STAGE_XP[beat.stage],
      ...(beat.stage === "clash" || beat.stage === "after" ? { notes: 1 } : {}),
    },
    { type: "set-flag", flag: beat.progress, value: true },
    { type: "set-flag", flag: choice.flag, value: true },
    { type: "remember", npcId: post.id, key: beat.stage, value: choice.memory },
    { type: "set-quest-node", questId: post.questId, node: beat.stage },
  ];
  if (beat.stage === "meet") list.push({ type: "discover-place", placeId: post.placeId });
  if (beat.main) {
    list.push({ type: "quest-reward", questId: `${STUDIO_QUEST_ID}-${beat.main}`, xp: 4 });
    list.push({ type: "set-quest-node", questId: STUDIO_QUEST_ID, node: beat.main });
  }
  return list;
}

function linesOf(beat: BeatSpec): Line[] {
  const conditional = (beat.flagLines ?? []).map((entry) => ({
    when: { op: "flag" as const, id: entry.flag, equals: true },
    text: zh(entry.text),
  }));
  return [...conditional, { text: zh(beat.line) }];
}

function eventOf(post: FacultyPost, beat: BeatSpec): EventRecord {
  const choices: Choice[] = beat.choices.map((choice) => ({
    id: choice.id,
    text: zh(choice.text),
    effects: effects(post, beat, choice),
    outcome: [{ text: zh(choice.outcome) }],
    nextEventId: null,
  }));
  return {
    id: beat.id,
    version: 1,
    placeId: post.placeId,
    npcIds: [post.id, ...(beat.also ?? [])],
    priority: beat.stage === "meet" ? 10 : beat.stage === "clash" ? 20 : beat.stage === "turn" ? 30 : 40,
    weight: 1,
    cooldownMinutes: 0,
    mutexGroup: null,
    mutexMinutes: 0,
    once: true,
    autoFire: false,
    anomaly: false,
    evidence: "fictional",
    ...(beat.when?.length
      ? { when: { op: "all" as const, of: beat.when.map((id) => ({ op: "flag" as const, id, equals: true })) } }
      : {}),
    lines: linesOf(beat),
    choices,
    assets: { images: [], audio: [], animation: ["existing:idle"] },
    status: {
      authored: true,
      validated: true,
      previewed: true,
      integrated: false,
      reviewed: false,
    },
    recovery: {
      leave: zh(`你先離開。${post.name}沒有把這段算成已談完，也沒有發東西。`),
      unavailable: zh(`${post.name}這時沒有新的話。你可以繼續走。`),
    },
  };
}

function placeOf(post: FacultyPost): PlaceRecord {
  const metres = Math.round(Math.hypot(post.dx, post.dz));
  return {
    id: post.placeId,
    name: `${post.name}的位子`,
    zone: post.zone,
    use: `虛構角色${post.name}站在${siteName(post.siteId)}門外約 ${metres} 公尺。不是實測辦公室，也不是校方公布的位置。`,
    evidence: "fictional",
    accuracy: "estimated",
    aliasOf: null,
    sources: [MAP_SOURCE],
    pending: ["座標由既有門口外推，不能當成實測還原。"],
    conflicts: [],
    relatedQuests: [post.questId],
    claims: [],
    figures: [],
    recordClass: "landmark",
    registryStatus: null,
    notes: post.look.provisional,
  };
}

export function facultySlice(): {
  places: PlaceRecord[];
  npcs: NpcRecord[];
  quests: QuestRecord[];
  events: EventRecord[];
} {
  const posts = facultyPosts();
  const byId = new Map(posts.map((post) => [post.id, post]));
  return {
    places: posts.map((post) => placeOf(post)),
    npcs: posts.map((post) => ({
      id: post.id,
      name: post.name,
      evidence: "fictional" as const,
      collegeId: post.collegeId,
      departmentId: post.departmentId,
      officialUnit: null,
      unmappedDepartment: false,
      voice: post.voice,
      note: `虛構角色。${post.role}。${post.personality}${post.look.provisional}`,
    })),
    quests: [studioQuest(), ...FACULTY_CAST.map(personQuest)],
    events: FACULTY_BEATS.map((beat) => {
      const post = byId.get(beat.npcId);
      if (!post) throw new Error(`faculty beat ${beat.id} has no post`);
      return eventOf(post, beat);
    }),
  };
}
