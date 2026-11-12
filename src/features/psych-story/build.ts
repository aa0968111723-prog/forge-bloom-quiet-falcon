import { CAMPUS_SITES } from "../../game/rpg/campus.ts";
import type {
  Choice,
  Condition,
  Effect,
  EventRecord,
  Line,
  NpcRecord,
  PlaceRecord,
  QuestRecord,
} from "../narrative/types.ts";
import { PSYCH_CAST } from "./cast.ts";
import { psychPosts, type PsychPost } from "./posts.ts";

const QUEST_ID = "quest-psych-cause";

const MAP_SOURCE = {
  url: "https://classic.tku.edu.tw/doc/CampusMap202103.pdf",
  consulted: "2026-11-12",
  version:
    "檔名 CampusMap202103（2021-03）。本輪沒有重新下載 PDF。站點是門口外推的估計位置，不升為 surveyed。",
  confidence: "inherited-registry" as const,
};

type Stage = "meet" | "turn" | "after";

type ChoiceSpec = {
  id: string;
  text: string;
  flag: string;
  memory: string;
  outcome: string;
};

type BeatSpec = {
  id: string;
  stage: Stage;
  line: string;
  flagLines?: { flags: string[]; text: string }[];
  when?: string[];
  choices: [ChoiceSpec, ChoiceSpec];
  xp: number;
  notes?: number;
};

const BEATS: readonly BeatSpec[] = [
  {
    id: "evt-psych-meet",
    stage: "meet",
    line: "剛才報告時，那一頁我叫不出來。你覺得那一下是怎麼發生的？",
    choices: [
      {
        id: "psych-meet-retrieve",
        text: "是我沒把那一頁提取出來。",
        flag: "psych-retrieve",
        memory: "retrieve",
        outcome: "許回把你的話記下來：沒提取出來。",
      },
      {
        id: "psych-meet-load",
        text: "是當時兩件事一起擠進來，那一頁被擠掉了。",
        flag: "psych-load",
        memory: "load",
        outcome: "許回把你的話記下來：兩件事擠掉了那一頁。",
      },
    ],
    xp: 6,
  },
  {
    id: "evt-psych-turn",
    stage: "turn",
    when: ["psych-meet"],
    line: "許回問你現在要怎麼把精神找回來。",
    flagLines: [
      {
        flags: ["psych-retrieve"],
        text: "許回先複述你的歸因：你說是沒把那一頁提取出來。現在要怎麼把精神找回來？",
      },
      {
        flags: ["psych-load"],
        text: "許回先複述你的歸因：你說是兩件事擠掉了那一頁。現在要怎麼把精神找回來？",
      },
    ],
    choices: [
      {
        id: "psych-turn-pause",
        text: "先停一下，只找回那一頁。",
        flag: "psych-pause",
        memory: "pause",
        outcome: "你們先停一下。許回沒有把停一下說成治療。",
      },
      {
        id: "psych-turn-shed",
        text: "先放下其中一件，再回來取那一頁。",
        flag: "psych-shed",
        memory: "shed",
        outcome: "你們先放下其中一件。許回沒有把放下說成失敗。",
      },
    ],
    xp: 8,
  },
  {
    id: "evt-psych-after",
    stage: "after",
    when: ["psych-turn"],
    line: "許回用你剛才的話把這段收起來。",
    flagLines: [
      {
        flags: ["psych-retrieve", "psych-pause"],
        text: "許回用你的原話收尾：沒提取出來，後來你選擇先停一下，只找回那一頁。",
      },
      {
        flags: ["psych-retrieve", "psych-shed"],
        text: "許回用你的原話收尾：沒提取出來，後來你選擇先放下其中一件。",
      },
      {
        flags: ["psych-load", "psych-pause"],
        text: "許回用你的原話收尾：兩件事擠掉了那一頁，後來你選擇先停一下，只找回那一頁。",
      },
      {
        flags: ["psych-load", "psych-shed"],
        text: "許回用你的原話收尾：兩件事擠掉了那一頁，後來你選擇先放下其中一件。",
      },
    ],
    choices: [
      {
        id: "psych-after-note",
        text: "把這句留在筆記上。",
        flag: "psych-note",
        memory: "note",
        outcome: "這句留在筆記上。下次開口會先看到你自己的歸因。",
      },
      {
        id: "psych-after-group",
        text: "把這句說給下一組聽。",
        flag: "psych-group",
        memory: "group",
        outcome: "這句留給下一組。他們會聽到你當時怎麼解釋。",
      },
    ],
    xp: 10,
    notes: 1,
  },
];

function zh(text: string): { "zh-Hant": string } {
  return { "zh-Hant": text };
}

function lineWhen(flags: string[]): Condition {
  return { op: "all", of: flags.map((id) => ({ op: "flag", id, equals: true })) };
}

function linesOf(beat: BeatSpec): Line[] {
  const conditional = (beat.flagLines ?? []).map((entry) => ({
    when: lineWhen(entry.flags),
    text: zh(entry.text),
  }));
  return [...conditional, { text: zh(beat.line) }];
}

function effects(post: PsychPost, beat: BeatSpec, choice: ChoiceSpec): Effect[] {
  const list: Effect[] = [
    {
      type: "quest-reward",
      questId: `${QUEST_ID}-${beat.stage}`,
      xp: beat.xp,
      ...(beat.notes ? { notes: beat.notes } : {}),
    },
    { type: "set-flag", flag: `psych-${beat.stage}`, value: true },
    { type: "set-flag", flag: choice.flag, value: true },
    { type: "remember", npcId: post.id, key: beat.stage, value: choice.memory },
    { type: "set-quest-node", questId: QUEST_ID, node: beat.stage },
  ];
  if (beat.stage === "meet") list.push({ type: "discover-place", placeId: post.placeId });
  return list;
}

function eventOf(post: PsychPost, beat: BeatSpec): EventRecord {
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
    npcIds: [post.id],
    priority: beat.stage === "meet" ? 10 : beat.stage === "turn" ? 20 : 30,
    weight: 1,
    cooldownMinutes: 0,
    mutexGroup: null,
    mutexMinutes: 0,
    once: true,
    autoFire: false,
    anomaly: false,
    evidence: "fictional",
    ...(beat.when?.length ? { when: lineWhen(beat.when) } : {}),
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
      leave: zh("你先離開。許回沒有把這段算成已談完，也沒有發東西。"),
      unavailable: zh("許回這時沒有新的話。你可以繼續走。"),
    },
  };
}

function quest(): QuestRecord {
  return {
    id: QUEST_ID,
    title: zh("那一頁怎麼掉的"),
    evidence: "fictional",
    arc: true,
    nodes: [
      { id: "meet", requires: null, summary: zh("說明那一頁是沒提取出來，或是被兩件事擠掉。") },
      { id: "turn", requires: "meet", summary: zh("聽許回復述你的歸因，再選怎麼把精神找回來。") },
      { id: "after", requires: "turn", summary: zh("許回用你的原話收尾。留在筆記上，或說給下一組聽。") },
    ],
    rewardIds: (["meet", "turn", "after"] as const).map((stage) => `${QUEST_ID}-${stage}`),
  };
}

function placeOf(post: PsychPost): PlaceRecord {
  const site = CAMPUS_SITES.find((entry) => entry.id === post.siteId);
  const metres = Math.round(Math.hypot(post.dx, post.dz));
  return {
    id: post.placeId,
    name: `${post.name}的位子`,
    zone: post.zone,
    use: `虛構同學${post.name}站在${site?.name ?? post.siteId}門外約 ${metres} 公尺。不是實測位置。`,
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
    notes: "用既有學生模型站立。沒有新的角色組。",
  };
}

export function psychSlice(): {
  places: PlaceRecord[];
  npcs: NpcRecord[];
  quests: QuestRecord[];
  events: EventRecord[];
} {
  const posts = psychPosts();
  return {
    places: posts.map(placeOf),
    npcs: posts.map((post) => ({
      id: post.id,
      name: post.name,
      evidence: "fictional" as const,
      collegeId: post.collegeId,
      departmentId: post.departmentId,
      officialUnit: null,
      unmappedDepartment: false,
      voice: post.voice,
      note: "虛構同學。問的是歸因和怎麼把精神找回來，不是診斷，也不是治療。",
    })),
    quests: [quest()],
    events: BEATS.map((beat) => eventOf(posts[0], beat)),
  };
}
