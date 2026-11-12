import { facultyPosts, nearestFacultyPost, FACULTY_REACH } from "../../features/faculty-story/posts.ts";
import { nearestPsychPost, psychPosts, PSYCH_REACH } from "../../features/psych-story/posts.ts";
import { LANDMARKS, landmarkAt, terrainHeight } from "../world.ts";
import { CAMPUS_SITES, SUPPLY_NODES, siteEntrance } from "./campus.ts";
import { ITEMS, RECIPES, type BuildKind } from "./data.ts";
import {
  canPay,
  clearSight,
  footprint,
  validatePlacement,
  type Building,
} from "./rules.ts";
import { BUILD_NEED_MATERIALS } from "./buildcard.ts";
import { nearestFacility } from "../../features/items-equipment-building/facilities.ts";

/** Short scene marker. The same words are the DOM action when it is legal. */
export const PROMPT_MARKER_SCALE = 0.35;
const INTERIOR_NOTES_MARKER_SCALE = 0.2;
const NAMEPLATE_SCALE = 0.48;
const NAMEPLATE_REACH = 85;

export type PromptKind =
  | "pickup"
  | "supply"
  | "cool"
  | "talk"
  | "enter"
  | "arrive"
  | "stamp"
  | "open"
  | "exit"
  | "notes"
  | "place"
  | "facility"
  | "repair";

export type PromptChoice = {
  kind: PromptKind;
  text: string;
  marker: string;
  reason: string | null;
  targetId: string;
  x: number;
  z: number;
};

export type PromptSnap = {
  phase: string;
  hp: number;
  panel: string | null;
  plaqueId: string | null;
  interiorId: string | null;
  buildKind: BuildKind | null;
  rotation: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  buildings: Building[];
  loot: { id: string; x: number; z: number; items: Record<string, number> }[];
  harvested: Record<string, number>;
  now: number;
  visited: readonly string[];
  /** Copied bag slots. The preview must not call inventory.add. */
  slots: { itemId: string; quantity: number }[];
  capacity: number;
  count: (id: string) => number;
  /** Survey gear can extend the supply reach. Missing means SUPPLY_REACH. */
  reach?: number;
  /** Moving an existing facility does not ask for materials again. */
  relocating?: boolean;
  /** Equipped main tool. Missing means the repair prompt stays hidden. */
  tool?: string | null;
};

export type PromptView = {
  x: number;
  y: number;
  z: number;
  fx: number;
  fy: number;
  fz: number;
  fov: number;
  width: number;
  height: number;
};

export type PromptLabel = {
  kind: PromptKind | "name";
  id: string;
  text: string;
  action: boolean;
  shown: boolean;
  anchor: { x: number; y: number; z: number };
  rect: { x: number; y: number; w: number; h: number } | null;
  scale: number;
};

/** Same reach promptDecision uses before it offers 補給. */
export const SUPPLY_REACH = 4;
/** Overworld inventory capacity. store.ts creates the bag with this value. */
export const BAG_CAPACITY = 24;
/** Piles at least this close share one world mesh. */
export const LOOT_CLUSTER = 1.2;
/** At this many nearby piles, only one label stays eligible. */
export const LOOT_CROWD = 4;
/** Ready crates and loot stay out of the far view past this camera distance. */
export const GROUND_DRAW = 28;
/** Contour, cooled hint mesh, and pickup ring. Text stays inside reach 4. */
export const OUTLINE_REACH = 16;

export function buildSpot(x: number, z: number, yaw: number) {
  return {
    x: Math.round((x - Math.sin(yaw) * 5) * 2) / 2,
    z: Math.round((z - Math.cos(yaw) * 5) * 2) / 2,
  };
}

/** Ghost color when the current aim can be built. */
export const PLACE_GHOST_READY = "#7ddac3";
/** Ghost color when the current aim is refused. */
export const PLACE_GHOST_BLOCKED = "#ed786b";
/** Words the ghost shows when the aim is legal. Invalid aims use the refusal. */
export const PLACE_LEGAL_WORD = "合法";

export type PlaceJudge = {
  reason: string | null;
  legal: boolean;
  words: string;
  color: string;
  width: number;
  depth: number;
  cost: Record<string, number>;
};

export type PlaceVerdict = PlaceJudge & {
  kind: BuildKind;
  spot: { x: number; z: number };
  facing: number;
  yaw: number;
};

/** Placement and cost for one coordinate. The same object place() notifies from. */
export function judgePlacement(
  kind: BuildKind,
  x: number,
  z: number,
  rotation: number,
  buildings: Building[],
  player: { x: number; z: number } | undefined,
  count: (id: string) => number,
  paid = false,
): PlaceJudge {
  const box = footprint(kind, rotation);
  const recipe = RECIPES.find((item) => item.id === kind);
  const blocked = validatePlacement(kind, x, z, rotation, buildings, player);
  const reason =
    blocked ??
    (paid || (recipe && canPay(recipe.cost, count)) ? null : BUILD_NEED_MATERIALS);
  const legal = reason == null;
  return {
    reason,
    legal,
    words: reason ?? PLACE_LEGAL_WORD,
    color: legal ? PLACE_GHOST_READY : PLACE_GHOST_BLOCKED,
    width: box.width,
    depth: box.depth,
    cost: recipe?.cost ?? {},
  };
}

/** Current aim: spot, facing, rotated footprint, cost, and legal or invalid words. */
export function placeVerdict(input: {
  kind: BuildKind;
  x: number;
  z: number;
  yaw: number;
  rotation: number;
  buildings: Building[];
  count: (id: string) => number;
  paid?: boolean;
}): PlaceVerdict {
  const spot = buildSpot(input.x, input.z, input.yaw);
  return {
    ...judgePlacement(
      input.kind,
      spot.x,
      spot.z,
      input.rotation,
      input.buildings,
      { x: input.x, z: input.z },
      input.count,
      input.paid === true,
    ),
    kind: input.kind,
    spot,
    facing: input.rotation,
    yaw: input.yaw,
  };
}

function inExitZone(snap: PromptSnap) {
  return snap.playerZ > 5 && Math.abs(snap.playerX) < 3;
}

function choice(
  kind: PromptKind,
  text: string,
  marker: string,
  targetId: string,
  x: number,
  z: number,
  reason: string | null = null,
): PromptChoice {
  return { kind, text, marker, reason, targetId, x, z };
}

type BagSlot = { itemId: string; quantity: number };
type ItemBag = { [id: string]: number | undefined };

function grantList(items: ItemBag) {
  return ITEMS.flatMap((item) => {
    const amount = items[item.id];
    return typeof amount === "number" && amount > 0
      ? [`${item.name} ×${amount}`]
      : [];
  }).join("、");
}

function intakeLine(
  accepted: Record<string, number>,
  left: Record<string, number>,
  lead = "",
) {
  const lines: string[] = [];
  if (lead) lines.push(lead);
  const bagged = grantList(accepted);
  const ground = grantList(left);
  if (bagged) lines.push(`已入袋：${bagged}`);
  if (ground) lines.push(`留在地面：${ground}`);
  return lines.join("。");
}

/**
 * Same fill-existing-then-open-slots loop as inventory.add.
 * Copies slots and does not write the bag.
 */
export function intakePreview(
  slots: readonly BagSlot[],
  capacity: number,
  items: ItemBag,
) {
  const next = slots.map((slot) => ({
    itemId: slot.itemId,
    quantity: slot.quantity,
  }));
  const accepted: Record<string, number> = {};
  const left: Record<string, number> = {};
  for (const [id, amount] of Object.entries(items)) {
    if (typeof amount !== "number") continue;
    const quantity = Math.floor(amount);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const def = ITEMS.find((item) => item.id === id);
    if (!def) {
      left[id] = quantity;
      continue;
    }
    const maxStack = def.maxStack ?? Number.POSITIVE_INFINITY;
    let remaining = quantity;
    for (const slot of next) {
      if (remaining === 0) break;
      if (slot.itemId !== id || slot.quantity >= maxStack) continue;
      const take = Math.min(maxStack - slot.quantity, remaining);
      slot.quantity += take;
      remaining -= take;
    }
    while (remaining > 0 && next.length < capacity) {
      const take = Math.min(maxStack, remaining);
      next.push({ itemId: id, quantity: take });
      remaining -= take;
    }
    const added = quantity - remaining;
    if (added > 0) accepted[id] = added;
    if (remaining > 0) left[id] = remaining;
  }
  return { accepted, left };
}

function offerLine(items: ItemBag, snap: PromptSnap) {
  const preview = intakePreview(snap.slots, snap.capacity, items);
  return intakeLine(preview.accepted, preview.left, grantList(items));
}

function coolLine(items: ItemBag) {
  const names = grantList(items);
  return names ? `已冷卻：${names}` : "已冷卻";
}

export type LootCluster<T extends { id: string; x: number; z: number }> = {
  id: string;
  x: number;
  z: number;
  members: T[];
};

/** Groups nearby piles for the world mesh. Stored piles stay separate. */
export function lootClusters<T extends { id: string; x: number; z: number }>(
  piles: readonly T[],
): LootCluster<T>[] {
  const parent = piles.map((_, index) => index);
  const find = (index: number): number => {
    const head = parent[index];
    if (head === undefined || head === index) return index;
    const root = find(head);
    parent[index] = root;
    return root;
  };
  const union = (a: number, b: number) => {
    const left = find(a);
    const right = find(b);
    if (left !== right) parent[left] = right;
  };
  for (let i = 0; i < piles.length; i++) {
    const pile = piles[i];
    if (!pile) continue;
    for (let j = i + 1; j < piles.length; j++) {
      const other = piles[j];
      if (!other) continue;
      if (Math.hypot(pile.x - other.x, pile.z - other.z) <= LOOT_CLUSTER)
        union(i, j);
    }
  }
  const groups = new Map<number, T[]>();
  piles.forEach((pile, index) => {
    const key = find(index);
    const list = groups.get(key);
    if (list) list.push(pile);
    else groups.set(key, [pile]);
  });
  return [...groups.values()].map((members) => {
    const head = members[0];
    const x = members.reduce((sum, pile) => sum + pile.x, 0) / members.length;
    const z = members.reduce((sum, pile) => sum + pile.z, 0) / members.length;
    return { id: head?.id ?? "", x, z, members };
  });
}

export function groundBand(
  distance: number,
  cooled: boolean,
): "hidden" | "prop" | "marked" {
  if (!(distance < (cooled ? OUTLINE_REACH : GROUND_DRAW))) return "hidden";
  return distance < OUTLINE_REACH ? "marked" : "prop";
}

/** Mesh and contour for one supply or one loot cluster. */
export function pickupOutline(distance: number, cooled: boolean, sight: boolean) {
  const band = groundBand(distance, cooled);
  return { mesh: band !== "hidden", outline: band === "marked" && sight };
}

/** The one action E, F, touch, and the prompt button are allowed to run. */
export function promptDecision(snap: PromptSnap): PromptChoice | null {
  if (snap.phase !== "playing" || snap.hp <= 0 || snap.panel || snap.plaqueId)
    return null;
  if (snap.buildKind) {
    const verdict = placeVerdict({
      kind: snap.buildKind,
      x: snap.playerX,
      z: snap.playerZ,
      yaw: snap.playerYaw,
      rotation: snap.rotation,
      buildings: snap.buildings,
      count: snap.count,
      paid: snap.relocating === true,
    });
    const words = verdict.legal ? "放置" : verdict.words;
    return choice(
      "place",
      words,
      words,
      "place",
      verdict.spot.x,
      verdict.spot.z,
      verdict.reason,
    );
  }
  if (snap.interiorId) {
    if (inExitZone(snap))
      return choice("exit", "返回校園", "返回校園", "exit", 0, 6.8);
    return choice(
      "notes",
      "整理筆記",
      "整理筆記",
      "notes",
      snap.playerX,
      snap.playerZ,
    );
  }
  const drop = snap.loot.find(
    (pile) =>
      Math.hypot(snap.playerX - pile.x, snap.playerZ - pile.z) < 4 &&
      inSight(snap, pile.x, pile.z),
  );
  if (drop) {
    const line = offerLine(drop.items, snap);
    return choice("pickup", line, line, drop.id, drop.x, drop.z);
  }
  const node = SUPPLY_NODES.find(
    (item) =>
      Math.hypot(item.x - snap.playerX, item.z - snap.playerZ) < (snap.reach ?? SUPPLY_REACH) &&
      (snap.harvested[item.id] ?? 0) < snap.now &&
      inSight(snap, item.x, item.z),
  );
  if (node) {
    const line = offerLine(node.items, snap);
    return choice("supply", line, line, node.id, node.x, node.z);
  }
  const post = nearestFacultyPost(snap.playerX, snap.playerZ);
  if (post && inSight(snap, post.x, post.z)) {
    return choice("talk", `與${post.name}交談`, "交談", post.placeId, post.x, post.z);
  }
  const classmate = nearestPsychPost(snap.playerX, snap.playerZ);
  if (classmate && inSight(snap, classmate.x, classmate.z)) {
    return choice("talk", `與${classmate.name}交談`, "交談", classmate.placeId, classmate.x, classmate.z);
  }
  const site = CAMPUS_SITES.find((item) => {
    const door = siteEntrance(item);
    return Math.hypot(door.x - snap.playerX, door.z - snap.playerZ) < 5;
  });
  if (site) {
    const door = siteEntrance(site);
    const arrive = site.form === "court";
    return choice(
      arrive ? "arrive" : "enter",
      (arrive ? "抵達" : "進入") + site.name,
      arrive ? "抵達" : "進入",
      site.id,
      door.x,
      door.z,
    );
  }
  const landmark = landmarkAt(snap.playerX, snap.playerZ);
  if (!landmark) {
    const facility = nearestFacility(snap.buildings, snap.playerX, snap.playerZ);
    if (facility && inSight(snap, facility.x, facility.z, facility.id))
      return choice("facility", facility.verb, facility.verb, facility.id, facility.x, facility.z);
    const wounded = damagedFacility(snap);
    if (snap.tool === "repair-wrench" && wounded && inSight(snap, wounded.x, wounded.z, wounded.id))
      return choice("repair", "修復設施", "修復", wounded.id, wounded.x, wounded.z);
    return null;
  }
  const seen = snap.visited.includes(landmark.id);
  return choice(
    seen ? "open" : "stamp",
    (seen ? "閱讀 · " : "蓋章 · ") + landmark.name,
    seen ? "閱讀" : "蓋章",
    landmark.id,
    landmark.x,
    landmark.z,
  );
}

type Draft = {
  kind: PromptKind | "name";
  id: string;
  text: string;
  x: number;
  z: number;
  y: number;
  scale: number;
  eligible: boolean;
  sight: boolean;
};

function inSight(snap: PromptSnap, x: number, z: number, ignoreId?: string) {
  const buildings = snap.interiorId
    ? []
    : snap.buildings.filter((building) => building.id !== ignoreId);
  return clearSight(snap.playerX, snap.playerZ, x, z, buildings);
}

/** Closest damaged building inside the wrench's 6 m reach. */
function damagedFacility(snap: PromptSnap) {
  let best: Building | null = null;
  let bestDistance = 6;
  for (const building of snap.buildings) {
    const recipe = RECIPES.find((item) => item.id === building.kind);
    if (!recipe || building.hp <= 0 || building.hp >= recipe.health) continue;
    const distance = Math.hypot(building.x - snap.playerX, building.z - snap.playerZ);
    if (distance > bestDistance) continue;
    best = building;
    bestDistance = distance;
  }
  return best;
}

function project(
  anchor: { x: number; y: number; z: number },
  view: PromptView,
  scale: number,
) {
  const length = Math.hypot(view.fx, view.fy, view.fz) || 1;
  const fvx = view.fx / length,
    fvy = view.fy / length,
    fvz = view.fz / length;
  let rightX = -fvz,
    rightY = 0,
    rightZ = fvx;
  let rightLength = Math.hypot(rightX, rightZ);
  if (rightLength < 1e-6) {
    rightX = 1;
    rightZ = 0;
    rightLength = 1;
  }
  rightX /= rightLength;
  rightZ /= rightLength;
  const upX = rightY * fvz - rightZ * fvy;
  const upY = rightZ * fvx - rightX * fvz;
  const upZ = rightX * fvy - rightY * fvx;
  const dx = anchor.x - view.x,
    dy = anchor.y - view.y,
    dz = anchor.z - view.z;
  const depth = dx * fvx + dy * fvy + dz * fvz;
  if (depth <= 0.05) return null;
  const tan = Math.tan(((view.fov * Math.PI) / 180) / 2);
  const aspect = view.width / Math.max(1, view.height);
  const sx =
    (0.5 + (dx * rightX + dy * rightY + dz * rightZ) / (2 * depth * tan * aspect)) *
    view.width;
  const sy =
    (0.5 - (dx * upX + dy * upY + dz * upZ) / (2 * depth * tan)) * view.height;
  const w = ((8 * scale) / (depth * tan * aspect)) * (view.width / 2);
  const h = ((1.5 * scale) / (depth * tan)) * (view.height / 2);
  const rect = { x: sx - w / 2, y: sy - h / 2, w, h };
  const onScreen =
    rect.x < view.width &&
    rect.y < view.height &&
    rect.x + rect.w > 0 &&
    rect.y + rect.h > 0;
  return onScreen ? rect : null;
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Which scene markers are drawn. Operable distance, the shared sight rule,
 * screen overlap, and the camera. Anchors stay on the world targets.
 */
export function promptLabels(
  snap: PromptSnap,
  view: PromptView,
  decision: PromptChoice | null = promptDecision(snap),
): PromptLabel[] {
  const drafts: Draft[] = [];
  const add = (
    kind: PromptKind | "name",
    id: string,
    text: string,
    x: number,
    z: number,
    eligible: boolean,
    scale: number,
    y = terrainHeight(x, z) + 2.4,
  ) => {
    drafts.push({
      kind,
      id,
      text,
      x,
      z,
      y,
      scale,
      eligible,
      sight: inSight(snap, x, z),
    });
  };
  if (snap.interiorId) {
    const leaving = decision?.kind === "exit";
    add("exit", "exit", "返回校園", 0, 6.8, leaving, PROMPT_MARKER_SCALE, 3);
    if (decision?.kind === "notes")
      add(
        "notes",
        "notes",
        "整理筆記",
        decision.x,
        decision.z,
        true,
        INTERIOR_NOTES_MARKER_SCALE,
        2.4,
      );
  } else if (snap.buildKind && decision?.kind === "place") {
    add(
      "place",
      "place",
      decision.marker,
      decision.x,
      decision.z,
      true,
      PROMPT_MARKER_SCALE,
    );
  } else if (!snap.interiorId && !snap.buildKind) {
    const quietLoot = new Set<string>();
    for (const cluster of lootClusters(snap.loot)) {
      if (cluster.members.length < LOOT_CROWD) continue;
      const primary =
        cluster.members.find((pile) => pile.id === decision?.targetId) ??
        cluster.members.find(
          (pile) =>
            Math.hypot(snap.playerX - pile.x, snap.playerZ - pile.z) < 4 &&
            inSight(snap, pile.x, pile.z),
        ) ??
        cluster.members[0];
      for (const pile of cluster.members) {
        if (pile.id !== primary?.id) quietLoot.add(pile.id);
      }
    }
    for (const pile of snap.loot) {
      const near =
        Math.hypot(snap.playerX - pile.x, snap.playerZ - pile.z) < 4 &&
        !quietLoot.has(pile.id);
      add("pickup", pile.id, "拾取", pile.x, pile.z, near, PROMPT_MARKER_SCALE);
    }
    for (const node of SUPPLY_NODES) {
      const ready = (snap.harvested[node.id] ?? 0) < snap.now;
      const near =
        Math.hypot(node.x - snap.playerX, node.z - snap.playerZ) < SUPPLY_REACH;
      if (ready) {
        add("supply", node.id, "補給", node.x, node.z, near, PROMPT_MARKER_SCALE);
        continue;
      }
      if (!near) continue;
      add(
        "cool",
        node.id,
        coolLine(node.items),
        node.x,
        node.z,
        true,
        PROMPT_MARKER_SCALE,
      );
    }
    for (const site of CAMPUS_SITES) {
      const door = siteEntrance(site);
      const near = Math.hypot(door.x - snap.playerX, door.z - snap.playerZ) < 5;
      const arriving = site.form === "court";
      add(
        arriving ? "arrive" : "enter",
        site.id,
        arriving ? "抵達" : "進入",
        door.x,
        door.z,
        near,
        PROMPT_MARKER_SCALE,
      );
      const plateReach =
        Math.hypot(view.x - door.x, view.z - door.z) < NAMEPLATE_REACH;
      add(
        "name",
        "name:" + site.id,
        site.code + " · " + site.name,
        door.x,
        door.z,
        plateReach,
        NAMEPLATE_SCALE,
        terrainHeight(door.x, door.z) + 3.6,
      );
    }
    for (const post of facultyPosts()) {
      const near = Math.hypot(snap.playerX - post.x, snap.playerZ - post.z) < FACULTY_REACH;
      add("talk", post.placeId, "交談", post.x, post.z, near, PROMPT_MARKER_SCALE);
      const plateReach = Math.hypot(view.x - post.x, view.z - post.z) < NAMEPLATE_REACH;
      add(
        "name",
        "faculty:" + post.id,
        post.name,
        post.x,
        post.z,
        plateReach,
        NAMEPLATE_SCALE,
        terrainHeight(post.x, post.z) + 2.2,
      );
    }
    for (const classmate of psychPosts()) {
      const near = Math.hypot(snap.playerX - classmate.x, snap.playerZ - classmate.z) < PSYCH_REACH;
      add("talk", classmate.placeId, "交談", classmate.x, classmate.z, near, PROMPT_MARKER_SCALE);
      const plateReach = Math.hypot(view.x - classmate.x, view.z - classmate.z) < NAMEPLATE_REACH;
      add(
        "name",
        "psych:" + classmate.id,
        classmate.name,
        classmate.x,
        classmate.z,
        plateReach,
        NAMEPLATE_SCALE,
        terrainHeight(classmate.x, classmate.z) + 2.2,
      );
    }
    for (const landmark of LANDMARKS) {
      const near =
        Math.hypot(snap.playerX - landmark.x, snap.playerZ - landmark.z) <
        landmark.radius;
      const seenBefore = snap.visited.includes(landmark.id);
      add(
        seenBefore ? "open" : "stamp",
        landmark.id,
        seenBefore ? "閱讀" : "蓋章",
        landmark.x,
        landmark.z,
        near,
        PROMPT_MARKER_SCALE,
      );
    }
  }
  const painted = drafts.map((item) => {
    const anchor = { x: item.x, y: item.y, z: item.z };
    const rect = project(anchor, view, item.scale);
    const legal =
      Boolean(decision) &&
      item.kind === decision?.kind &&
      item.id === decision?.targetId &&
      item.eligible &&
      item.sight;
    return { item, anchor, rect, legal };
  });
  const action = painted.find((item) => item.legal && item.rect);
  return painted.map(({ item, anchor, rect, legal }) => {
    let shown = Boolean(rect) && item.eligible && item.sight;
    const promptsOpen =
      snap.phase === "playing" &&
      snap.hp > 0 &&
      !snap.panel &&
      !snap.plaqueId &&
      !snap.interiorId &&
      !snap.buildKind;
    if (item.kind !== "name" && !decision) {
      if (!(item.kind === "cool" && promptsOpen)) shown = false;
    }
    if (!legal && action?.rect && rect && overlaps(rect, action.rect)) shown = false;
    if (legal) shown = Boolean(rect) && item.sight;
    return {
      kind: item.kind,
      id: item.id,
      text: legal && decision ? decision.marker : item.text,
      action: legal,
      shown,
      anchor,
      rect,
      scale: item.scale,
    };
  });
}
