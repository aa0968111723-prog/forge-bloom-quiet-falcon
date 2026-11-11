import { COLLEGE_IDS, DEPARTMENTS } from "../../game/departments.ts";
import { CAMPUS_REGISTRY } from "../../game/world-data/registry/index.ts";
import { REFERENCE_BY_ID } from "../../game/world-data/references.ts";
import { evalCondition } from "./conditions.ts";
import { createSession } from "./play.ts";
import { memoryKey } from "./conditions.ts";
import {
  ANIMATIONS,
  DATE_PATTERN,
  DISCLAIMER,
  EFFECT_TYPES,
  EVENT_ID_PATTERN,
  FLAG_PATTERN,
  NPC_ID_PATTERN,
  QUEST_ID_PATTERN,
  SKILL_ID_PATTERN,
} from "./schema.ts";
import { COLLEGE_ABILITIES } from "../../game/rpg/growth/abilities.ts";
import { MAIN_INTEGRATION } from "./adapter.ts";
import type { Catalog, Choice, Condition, Effect, EventRecord, LocaleText } from "./types.ts";
import { ZONES } from "./types.ts";

export type ValidationIssue = { code: string; message: string };
export type ValidationReport = {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function push(errors: ValidationIssue[], code: string, message: string) {
  errors.push({ code, message });
}

function localeIssues(errors: ValidationIssue[], text: LocaleText | undefined, path: string) {
  if (!text || typeof text["zh-Hant"] !== "string" || !text["zh-Hant"].trim()) {
    push(errors, "missing-locale", `${path} 缺少 zh-Hant`);
    return;
  }
  for (const [key, value] of Object.entries(text)) {
    if (typeof value !== "string" || !value.trim())
      push(errors, "missing-locale", `${path} 的 ${key} 是空的`);
  }
  if (text["zh-Hant"].includes("校方公告") && !text["zh-Hant"].includes("不是校方公告")) {
    push(errors, "fictional-as-official", `${path} 把虛構寫成校方公告`);
  }
  if (text["zh-Hant"].includes("真實校園事故") && !text["zh-Hant"].includes("不是真實校園事故")) {
    push(errors, "fictional-as-official", `${path} 把虛構寫成真實校園事故`);
  }
}

function conditionCollege(condition: Condition | undefined, found: Set<string>) {
  if (!condition) return;
  if (condition.op === "college") found.add(condition.id);
  if (condition.op === "all" || condition.op === "any")
    condition.of.forEach((entry) => conditionCollege(entry, found));
  if (condition.op === "not") conditionCollege(condition.of, found);
}

function effectIssues(errors: ValidationIssue[], catalog: Catalog, effect: Effect, path: string) {
  if (!isRecord(effect) || !EFFECT_TYPES.includes(effect.type)) {
    push(errors, "illegal-effect", `${path} 效果不在白名單`);
    return;
  }
  if (effect.type === "quest-reward") {
    if (!catalog.quests.some((quest) => quest.rewardIds.includes(effect.questId))) {
      push(errors, "broken-ref", `${path} 獎勵 ${effect.questId} 沒有登記`);
    }
  }
  if (effect.type === "set-flag" && !FLAG_PATTERN.test(effect.flag)) {
    push(errors, "broken-ref", `${path} 旗標名稱不合法`);
  }
  if (effect.type === "set-quest-node") {
    const quest = catalog.quests.find((entry) => entry.id === effect.questId);
    if (!quest || !quest.nodes.some((node) => node.id === effect.node)) {
      push(errors, "broken-ref", `${path} 任務節點不存在`);
    }
  }
  if (effect.type === "discover-place") {
    const place = catalog.places.find((entry) => entry.id === effect.placeId);
    if (!place) push(errors, "broken-ref", `${path} 探索地點不存在`);
    else if (place.aliasOf) push(errors, "broken-ref", `${path} 應探索正式 id，而不是別名`);
  }
  if (effect.type === "remember") {
    if (!catalog.npcs.some((npc) => npc.id === effect.npcId))
      push(errors, "broken-ref", `${path} 記憶對象不存在`);
    if (!FLAG_PATTERN.test(effect.key) || !effect.value.trim() || effect.value.length > 80) {
      push(errors, "broken-ref", `${path} 記憶內容不合法`);
    }
  }
  if (effect.type === "cooldown") {
    if (!catalog.events.some((event) => event.id === effect.eventId))
      push(errors, "broken-ref", `${path} 冷卻對象不存在`);
    if (!Number.isFinite(effect.minutes) || effect.minutes < 0)
      push(errors, "illegal-effect", `${path} 冷卻時間不合法`);
  }
}

function signature(choice: Choice): string {
  return JSON.stringify(choice.effects.filter((effect) => effect.type !== "quest-reward"));
}

function reachableIds(catalog: Catalog): Set<string> {
  const reachable = new Set<string>();
  const everNodes = new Set<string>();
  const flags: Record<string, boolean> = {};
  const memory: Record<string, string> = {};
  const fired: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    const session = { ...createSession("reach"), flags, memory, fired: [...fired], questNodes: {} };
    for (const event of catalog.events) {
      if (reachable.has(event.id)) continue;
      if (!evalCondition(event.when, { session, place: null, everNodes, abstractFreedom: true }))
        continue;
      reachable.add(event.id);
      changed = true;
      fired.push(event.id);
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.type === "set-flag" && effect.value) flags[effect.flag] = true;
          if (effect.type === "set-quest-node") everNodes.add(`${effect.questId}:${effect.node}`);
          if (effect.type === "remember")
            memory[memoryKey(effect.npcId, effect.key)] = effect.value;
        }
      }
    }
  }
  return reachable;
}

function autoFireLoops(events: EventRecord[]): string[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const edges = new Map<string, string[]>();
  for (const event of events) {
    if (!event.autoFire) continue;
    edges.set(
      event.id,
      event.choices
        .map((choice) => choice.nextEventId)
        .filter((id): id is string => Boolean(id && byId.has(id))),
    );
  }
  const problems: string[] = [];
  const color = new Map<string, "gray" | "black">();
  const stack: string[] = [];
  const visit = (id: string) => {
    color.set(id, "gray");
    stack.push(id);
    for (const next of edges.get(id) ?? []) {
      if (color.get(next) === "gray") {
        const cycle = stack.slice(stack.indexOf(next));
        const trapped = cycle.every((eventId) => {
          const event = byId.get(eventId);
          if (!event) return true;
          return event.choices.every(
            (choice) => choice.nextEventId && cycle.includes(choice.nextEventId),
          );
        });
        if (trapped) problems.push(cycle.join(" → "));
      } else if (!color.has(next)) visit(next);
    }
    stack.pop();
    color.set(id, "black");
  };
  for (const id of edges.keys()) if (!color.has(id)) visit(id);
  return problems;
}

export function validateCatalog(catalog: Catalog): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!catalog || !Array.isArray(catalog.events) || !Array.isArray(catalog.places)) {
    return {
      ok: false,
      errors: [{ code: "broken-ref", message: "目錄不是可載入的物件" }],
      warnings,
    };
  }
  const seen = new Map<string, string>();
  const claim = (id: string, where: string) => {
    if (!id) push(errors, "missing-id", `${where} 缺少 id`);
    else if (seen.has(id))
      push(errors, "duplicate-id", `${id} 同時出現在 ${seen.get(id)} 與 ${where}`);
    else seen.set(id, where);
  };

  for (const place of catalog.places) {
    claim(place.id, "place");
    if (place.accuracy === "surveyed")
      push(errors, "surveyed-without-evidence", `${place.id} 標成 surveyed`);
    if (!ZONES.includes(place.zone)) push(errors, "broken-ref", `${place.id} 區域不存在`);
    if (!place.sources.length) push(errors, "missing-source", `${place.id} 沒有來源`);
    for (const source of place.sources) {
      if (
        !source.url.startsWith("https://") ||
        !DATE_PATTERN.test(source.consulted) ||
        !source.version ||
        !source.confidence
      ) {
        push(errors, "missing-source", `${place.id} 來源缺網址、日期、版本或可信度`);
      }
    }
    for (const figure of place.figures) {
      if (figure.accuracy === "surveyed")
        push(errors, "surveyed-without-evidence", `${place.id} 的 ${figure.label}`);
      if (!REFERENCE_BY_ID[figure.referenceId])
        push(errors, "broken-ref", `${place.id} 圖資引用不存在`);
    }
  }
  for (const place of catalog.places) {
    if (place.aliasOf && !catalog.places.some((entry) => entry.id === place.aliasOf)) {
      push(errors, "broken-ref", `${place.id} 的 aliasOf 不存在`);
    }
  }
  for (const row of CAMPUS_REGISTRY) {
    const hits = catalog.places.filter((place) => place.id === row.permanentId);
    if (hits.length !== 1) push(errors, "broken-ref", `registry ${row.permanentId} 沒有恰好一列`);
  }
  const named = catalog.places.filter((place) => place.recordClass === "building").length;
  if (named === catalog.places.length) {
    push(errors, "count-as-buildings", "清冊把每一列都當成建物");
  }

  for (const npc of catalog.npcs) {
    claim(npc.id, "npc");
    if (!NPC_ID_PATTERN.test(npc.id)) push(errors, "broken-ref", `${npc.id} 不符合 npc id`);
    if (npc.evidence !== "fictional")
      push(errors, "fictional-as-official", `${npc.name} 必須標成虛構`);
    if (npc.departmentId) {
      const department = DEPARTMENTS.find((entry) => entry.id === npc.departmentId);
      if (!department) push(errors, "broken-ref", `${npc.id} 科系不在 departments.ts`);
      else if (department.collegeId !== npc.collegeId)
        push(errors, "broken-ref", `${npc.id} 學院與科系不一致`);
    } else if (!npc.unmappedDepartment || !npc.officialUnit) {
      push(errors, "broken-ref", `${npc.id} 沒有科系 id 時要標未對應的官方單位`);
    }
    if (npc.collegeId && !COLLEGE_IDS.includes(npc.collegeId))
      push(errors, "broken-ref", `${npc.id} 學院不存在`);
  }

  for (const quest of catalog.quests) {
    claim(quest.id, "quest");
    if (!QUEST_ID_PATTERN.test(quest.id)) push(errors, "broken-ref", `${quest.id} 不符合 quest id`);
    localeIssues(errors, quest.title, quest.id);
    const nodes = new Set(quest.nodes.map((node) => node.id));
    if (nodes.size !== quest.nodes.length) push(errors, "duplicate-id", `${quest.id} 節點重複`);
    for (const node of quest.nodes) {
      localeIssues(errors, node.summary, `${quest.id}:${node.id}`);
      if (node.requires && !nodes.has(node.requires))
        push(errors, "unreachable", `${quest.id}:${node.id} 前置節點不存在`);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const walk = (id: string) => {
      if (visiting.has(id)) push(errors, "infinite-loop", `${quest.id} 節點 ${id} 循環`);
      if (visited.has(id)) return;
      visiting.add(id);
      const node = quest.nodes.find((entry) => entry.id === id);
      if (node?.requires) walk(node.requires);
      visiting.delete(id);
      visited.add(id);
    };
    for (const node of quest.nodes) walk(node.id);
    const rewardSeen = new Set<string>();
    for (const rewardId of quest.rewardIds) {
      if (rewardSeen.has(rewardId)) push(errors, "duplicate-id", `${rewardId} 重複登記`);
      rewardSeen.add(rewardId);
      if (!QUEST_ID_PATTERN.test(rewardId)) push(errors, "broken-ref", `${rewardId} 不是獎勵 id`);
    }
    if (quest.arc && quest.nodes.length < 3)
      push(errors, "unreachable", `${quest.id} 標成有起承轉合但少於三節點`);
  }

  const choiceIds = new Set<string>();
  for (const event of catalog.events) {
    claim(event.id, "event");
    if (!EVENT_ID_PATTERN.test(event.id) || event.version !== 1)
      push(errors, "broken-ref", `${event.id} 版本或 id 不對`);
    if (event.evidence !== "fictional")
      push(errors, "fictional-as-official", `${event.id} 必須標成虛構`);
    if (!catalog.places.some((place) => place.id === event.placeId))
      push(errors, "broken-ref", `${event.id} 地點不存在`);
    const place = catalog.places.find((entry) => entry.id === event.placeId);
    if (place && (place.zone === "cross-zone" || place.recordClass === "meta")) {
      push(errors, "broken-ref", `${event.id} 不能發生在跨區道路或地址紀錄`);
    }
    if (event.npcIds.length < 1) push(errors, "broken-ref", `${event.id} 沒有 NPC`);
    for (const npcId of event.npcIds) {
      if (!catalog.npcs.some((npc) => npc.id === npcId))
        push(errors, "broken-ref", `${event.id} 引用 ${npcId}`);
    }
    if (!(event.weight > 0) || event.cooldownMinutes < 0 || event.choices.length < 2) {
      push(errors, "broken-ref", `${event.id} 權重、冷卻或選項數量不合法`);
    }
    if (event.mutexGroup && event.mutexMinutes <= 0)
      push(errors, "broken-ref", `${event.id} 有互斥組卻沒有時間`);
    if (event.status.integrated && !MAIN_INTEGRATION) {
      push(errors, "false-integration", `${event.id} 標成已接入主遊戲，但接線仍是關閉的`);
    }
    if (!event.status.authored) push(errors, "missing-id", `${event.id} 尚未標成 authored`);
    for (const line of event.lines) localeIssues(errors, line.text, `${event.id} 開場`);
    localeIssues(errors, event.recovery.leave, `${event.id} 離開`);
    localeIssues(errors, event.recovery.unavailable, `${event.id} 條件不符`);
    if (event.anomaly && !JSON.stringify(event).includes(DISCLAIMER)) {
      push(errors, "fictional-as-official", `${event.id} 的異象沒有聲明不是公告或事故`);
    }
    const openChoices = event.choices.filter((choice) => !choice.when);
    if (openChoices.length < 2) push(errors, "broken-ref", `${event.id} 沒有兩個不限科系的選項`);
    const signatures = new Set(openChoices.map(signature));
    if (signatures.size < 2) push(errors, "duplicate-effect", `${event.id} 的兩個基本選項效果相同`);
    const defaults = openChoices.map(
      (choice) => choice.outcome.find((line) => !line.when)?.text["zh-Hant"] ?? "",
    );
    if (new Set(defaults).size < 2)
      push(errors, "duplicate-effect", `${event.id} 的兩個基本選項後續相同`);
    for (const choice of event.choices) {
      if (choiceIds.has(choice.id)) push(errors, "duplicate-id", `選項 ${choice.id} 重複`);
      choiceIds.add(choice.id);
      localeIssues(errors, choice.text, choice.id);
      if (!choice.outcome.some((line) => !line.when))
        push(errors, "missing-locale", `${choice.id} 沒有保底後續`);
      for (const line of choice.outcome) localeIssues(errors, line.text, `${choice.id} 後續`);
      if (choice.nextEventId && !catalog.events.some((entry) => entry.id === choice.nextEventId)) {
        push(errors, "broken-ref", `${choice.id} 的後續事件不存在`);
      }
      const rewardIds = choice.effects
        .filter((effect) => effect.type === "quest-reward")
        .map((effect) => effect.questId);
      if (new Set(rewardIds).size !== rewardIds.length)
        push(errors, "duplicate-reward", `${choice.id} 同一獎勵寫了兩次`);
      for (const effect of choice.effects) effectIssues(errors, catalog, effect, choice.id);
      if (choice.skillId) {
        if (!SKILL_ID_PATTERN.test(choice.skillId))
          push(errors, "broken-ref", `${choice.id} 技能 id`);
        const collegeId = choice.skillId.slice("college-ability:".length);
        if (!(collegeId in COLLEGE_ABILITIES))
          push(errors, "broken-ref", `${choice.id} 技能不在九學院`);
        const colleges = new Set<string>();
        conditionCollege(choice.when, colleges);
        if (!colleges.has(collegeId))
          push(errors, "broken-ref", `${choice.id} 技能沒有對應學院條件`);
      }
    }
    for (const clip of event.assets.animation) {
      if (!ANIMATIONS.includes(clip as (typeof ANIMATIONS)[number]))
        push(errors, "missing-asset", `${event.id} 動畫 ${clip}`);
    }
    for (const ref of [...event.assets.images, ...event.assets.audio]) {
      const asset = catalog.assets.find((entry) => entry.id === ref.id);
      if (!asset) push(errors, "missing-asset", `${event.id} 素材 ${ref.id}`);
      else if (ref.required && asset.status !== "ready")
        push(errors, "missing-asset", `${event.id} 必要素材 ${ref.id} 尚未完成`);
    }
    if (
      !event.once &&
      event.choices.some((choice) =>
        choice.effects.some((effect) => effect.type === "quest-reward"),
      )
    ) {
      warnings.push({
        code: "repeatable-reward",
        message: `${event.id} 可重複觸發，獎勵必須靠既有帳本擋第二次`,
      });
    }
  }

  for (const asset of catalog.assets) {
    claim(asset.id, "asset");
    if (!asset.licenseEvidence || !asset.author)
      push(errors, "missing-source", `${asset.id} 缺授權證據或作者`);
    if (asset.class === "research" && (asset.path || asset.hotlink || asset.redistributable)) {
      push(errors, "license", `${asset.id} 是研究參考，不能放進 public、熱連結或標成可再散布`);
    }
    if (asset.status === "ready" && asset.class !== "research" && !asset.path) {
      push(errors, "missing-asset", `${asset.id} 標成完成但沒有檔案位置`);
    }
    if (asset.status === "pending" && asset.path && asset.class === "original") {
      warnings.push({ code: "pending-asset", message: `${asset.id} 仍是 pending` });
    }
  }

  for (const brief of catalog.briefs) {
    for (const field of ["style", "size", "use", "format", "acceptance"] as const) {
      if (!brief[field]?.trim()) push(errors, "missing-asset", `${brief.id} 缺少 ${field}`);
    }
    if (brief.status === "ready" && brief.assetIds.length === 0)
      push(errors, "missing-asset", `${brief.id} 標成完成但沒有素材`);
    for (const assetId of brief.assetIds) {
      if (!catalog.assets.some((asset) => asset.id === assetId))
        push(errors, "broken-ref", `${brief.id} 素材 ${assetId}`);
    }
  }

  for (const row of catalog.units.mapped) {
    const department = DEPARTMENTS.find((entry) => entry.id === row.departmentId);
    if (!department) push(errors, "broken-ref", `官方單位 ${row.officialName} 對到不存在的科系`);
    else if (department.collegeId !== row.collegeId)
      push(errors, "broken-ref", `${row.officialName} 學院不一致`);
  }
  for (const row of catalog.units.unmapped) {
    if (row.departmentId) push(errors, "duplicate-id", `${row.officialName} 未對應卻寫了科系 id`);
    if (!COLLEGE_IDS.includes(row.collegeId))
      push(errors, "broken-ref", `${row.officialName} 學院不存在`);
  }

  const reachable = reachableIds(catalog);
  for (const event of catalog.events) {
    if (!reachable.has(event.id)) push(errors, "unreachable", `${event.id} 從開局走不到`);
  }
  for (const quest of catalog.quests) {
    for (const node of quest.nodes) {
      const set = catalog.events.some(
        (event) =>
          reachable.has(event.id) &&
          event.choices.some((choice) =>
            choice.effects.some(
              (effect) =>
                effect.type === "set-quest-node" &&
                effect.questId === quest.id &&
                effect.node === node.id,
            ),
          ),
      );
      if (!set) push(errors, "unreachable", `${quest.id}:${node.id} 沒有可到達的事件會推進它`);
    }
  }
  for (const loop of autoFireLoops(catalog.events)) push(errors, "infinite-loop", loop);

  if (!catalog.oss.length) push(errors, "missing-source", "沒有開源候選紀錄");
  for (const candidate of catalog.oss) {
    if (
      candidate.adopted &&
      !candidate.inspected.includes("node_modules") &&
      !candidate.inspected.includes("src/")
    ) {
      push(errors, "missing-source", `${candidate.name} 標成採用但沒有讀過程式`);
    }
    if (!candidate.license || !candidate.decision)
      push(errors, "missing-source", `${candidate.name} 缺授權或決定`);
  }

  const arcs = catalog.quests.filter((quest) => quest.arc).length;
  if (arcs >= 24)
    warnings.push({
      code: "target",
      message: "起承轉合任務鏈已達長期目標，請另行覆核不是換句灌數",
    });
  if (catalog.events.length >= 120)
    warnings.push({ code: "target", message: "事件數已達長期目標，請另行覆核" });

  return { ok: errors.length === 0, errors, warnings };
}
