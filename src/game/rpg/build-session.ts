import { BUILD_NEED_MATERIALS } from "./buildcard.ts";
import { ITEMS, RECIPES, type BuildKind } from "./data.ts";
import {
  BAG_CAPACITY,
  PLACE_GHOST_BLOCKED,
  PLACE_LEGAL_WORD,
  intakePreview,
  judgePlacement,
  placeVerdict,
} from "./prompts.ts";
import { FACILITY_CAP, footprint, validatePlacement, type Building } from "./rules.ts";
import { resolveCollision, type AABB } from "../world-data/colliders.ts";

export type BagSlot = { itemId: string; quantity: number };

export type SessionFacility = {
  id: string;
  kind: BuildKind;
  x: number;
  z: number;
  rotation: number;
  hp: number;
  maxHp: number;
};

export type BuildSession = {
  kind: BuildKind | null;
  rotation: number;
  playerX: number;
  playerZ: number;
  yaw: number;
  buildings: SessionFacility[];
  slots: BagSlot[];
  demolishId: string | null;
  nextSerial: number;
  settledEvents: string[];
};

export type SessionPreview = {
  legal: boolean;
  words: string;
  reason: string | null;
  color: string;
  cost: Record<string, number>;
  width: number;
  depth: number;
  spot: { x: number; z: number };
  facing: number;
  yaw: number;
  kind: BuildKind | null;
};

export type RefundLine = { itemId: string; name: string; quantity: number };

export type OverflowSpot = {
  itemId: string;
  name: string;
  quantity: number;
  x: number;
  z: number;
};

export type DemolishPlan = {
  ok: boolean;
  reason: string | null;
  id: string | null;
  refund: Record<string, number>;
  lines: RefundLine[];
  accepted: Record<string, number>;
  overflow: Record<string, number>;
  spots: OverflowSpot[];
};

export type FacilityListItem = {
  id: string;
  kind: BuildKind;
  name: string;
  purpose: string;
  x: number;
  z: number;
  durability: number;
  maxDurability: number;
  distance: number;
};

const IDLE_WORDS = "尚未開始建造";

export function createBuildSession(
  input: Partial<Omit<BuildSession, "slots" | "buildings">> & {
    slots?: readonly BagSlot[];
    buildings?: readonly SessionFacility[];
  } = {},
): BuildSession {
  return {
    kind: input.kind ?? null,
    rotation: input.rotation ?? 0,
    playerX: input.playerX ?? 0,
    playerZ: input.playerZ ?? 0,
    yaw: input.yaw ?? 0,
    buildings: (input.buildings ?? []).map((building) => ({ ...building })),
    slots: (input.slots ?? []).map((slot) => ({ ...slot })),
    demolishId: input.demolishId ?? null,
    nextSerial: input.nextSerial ?? 1,
    settledEvents: [...(input.settledEvents ?? [])],
  };
}

export function slotCount(slots: readonly BagSlot[], id: string) {
  let total = 0;
  for (const slot of slots) if (slot.itemId === id) total += slot.quantity;
  return total;
}

export function allowsImmediatePlay(state: BuildSession) {
  return state.kind === null;
}

function liveBuildings(state: BuildSession): Building[] {
  return state.buildings
    .filter((building) => building.hp > 0)
    .map((building) => ({
      id: building.id,
      kind: building.kind,
      x: building.x,
      z: building.z,
      rotation: building.rotation,
      hp: building.hp,
    }));
}

function countFrom(state: BuildSession) {
  return (id: string) => slotCount(state.slots, id);
}

function idlePreview(state: BuildSession): SessionPreview {
  return {
    legal: false,
    words: IDLE_WORDS,
    reason: IDLE_WORDS,
    color: PLACE_GHOST_BLOCKED,
    cost: {},
    width: 0,
    depth: 0,
    spot: { x: state.playerX, z: state.playerZ },
    facing: state.rotation,
    yaw: state.yaw,
    kind: null,
  };
}

/** Same judgePlacement path the commit uses. */
export function sessionPreview(state: BuildSession): SessionPreview {
  if (!state.kind) return idlePreview(state);
  const verdict = placeVerdict({
    kind: state.kind,
    x: state.playerX,
    z: state.playerZ,
    yaw: state.yaw,
    rotation: state.rotation,
    buildings: liveBuildings(state),
    count: countFrom(state),
  });
  return {
    legal: verdict.legal,
    words: verdict.words,
    reason: verdict.reason,
    color: verdict.color,
    cost: { ...verdict.cost },
    width: verdict.width,
    depth: verdict.depth,
    spot: { ...verdict.spot },
    facing: verdict.facing,
    yaw: verdict.yaw,
    kind: verdict.kind,
  };
}

export function beginBuild(state: BuildSession, kind: BuildKind): BuildSession {
  if (!RECIPES.some((recipe) => recipe.id === kind)) return state;
  return { ...state, kind, rotation: 0 };
}

export function moveBuild(state: BuildSession, x: number, z: number, yaw: number): BuildSession {
  return { ...state, playerX: x, playerZ: z, yaw };
}

export function rotateBuild(state: BuildSession): BuildSession {
  const quarter = (Math.round(state.rotation / (Math.PI / 2)) + 1) % 4;
  return { ...state, rotation: quarter * (Math.PI / 2) };
}

export function endBuild(state: BuildSession): BuildSession {
  return { ...state, kind: null };
}

export function cancelBuild(state: BuildSession): BuildSession {
  return endBuild(state);
}

function paySlots(slots: readonly BagSlot[], cost: Record<string, number>) {
  const next = slots.map((slot) => ({ ...slot }));
  for (const [id, raw] of Object.entries(cost)) {
    let remaining = Math.floor(raw);
    if (!Number.isFinite(remaining) || remaining <= 0) continue;
    for (const slot of next) {
      if (remaining === 0) break;
      if (slot.itemId !== id) continue;
      const take = Math.min(slot.quantity, remaining);
      slot.quantity -= take;
      remaining -= take;
    }
    if (remaining > 0) return null;
  }
  return next.filter((slot) => slot.quantity > 0);
}

export function commitBuild(state: BuildSession): {
  state: BuildSession;
  placed: boolean;
  preview: SessionPreview;
} {
  const preview = sessionPreview(state);
  if (!preview.legal || !preview.kind) return { state, placed: false, preview };
  const direct = judgePlacement(
    preview.kind,
    preview.spot.x,
    preview.spot.z,
    preview.facing,
    liveBuildings(state),
    { x: state.playerX, z: state.playerZ },
    countFrom(state),
  );
  if (
    direct.legal !== preview.legal ||
    direct.words !== preview.words ||
    direct.reason !== preview.reason
  ) {
    return {
      state,
      placed: false,
      preview: {
        ...preview,
        legal: false,
        words: "預覽與提交不一致",
        reason: "預覽與提交不一致",
      },
    };
  }
  const slots = paySlots(state.slots, preview.cost);
  if (!slots) return { state, placed: false, preview };
  const recipe = RECIPES.find((item) => item.id === preview.kind);
  if (!recipe) return { state, placed: false, preview };
  let serial = state.nextSerial;
  let id = `facility-${serial}`;
  while (state.buildings.some((building) => building.id === id)) {
    serial += 1;
    id = `facility-${serial}`;
  }
  const facility: SessionFacility = {
    id,
    kind: preview.kind,
    x: preview.spot.x,
    z: preview.spot.z,
    rotation: preview.facing,
    hp: recipe.health,
    maxHp: recipe.health,
  };
  return {
    state: {
      ...state,
      slots,
      nextSerial: serial + 1,
      buildings: [...state.buildings, facility],
    },
    placed: true,
    preview,
  };
}

export function facilityAabb(facility: SessionFacility): AABB {
  const box = footprint(facility.kind, facility.rotation);
  return {
    minX: facility.x - box.width / 2,
    maxX: facility.x + box.width / 2,
    minZ: facility.z - box.depth / 2,
    maxZ: facility.z + box.depth / 2,
  };
}

export function facilityColliders(state: BuildSession): AABB[] {
  return state.buildings.filter((building) => building.hp > 0).map(facilityAabb);
}

function fillSlots(slots: readonly BagSlot[], items: Record<string, number>) {
  const next = slots.map((slot) => ({ itemId: slot.itemId, quantity: slot.quantity }));
  const accepted: Record<string, number> = {};
  const left: Record<string, number> = {};
  for (const [id, amount] of Object.entries(items)) {
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
    while (remaining > 0 && next.length < BAG_CAPACITY) {
      const take = Math.min(maxStack, remaining);
      next.push({ itemId: id, quantity: take });
      remaining -= take;
    }
    const added = quantity - remaining;
    if (added > 0) accepted[id] = added;
    if (remaining > 0) left[id] = remaining;
  }
  return { slots: next, accepted, left };
}

function sameBag(a: Record<string, number>, b: Record<string, number>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if ((a[key] ?? 0) !== (b[key] ?? 0)) return false;
  return true;
}

function emptyPlan(reason: string, id: string | null = null): DemolishPlan {
  return {
    ok: false,
    reason,
    id,
    refund: {},
    lines: [],
    accepted: {},
    overflow: {},
    spots: [],
  };
}

function halfRefund(kind: BuildKind) {
  const recipe = RECIPES.find((item) => item.id === kind);
  const refund: Record<string, number> = {};
  if (!recipe) return refund;
  for (const [id, amount] of Object.entries(recipe.cost)) {
    const back = Math.floor(amount / 2);
    if (back > 0) refund[id] = back;
  }
  return refund;
}

function overflowSpots(
  overflow: Record<string, number>,
  x: number,
  z: number,
  extra: readonly AABB[],
): OverflowSpot[] {
  const spots: OverflowSpot[] = [];
  let index = 0;
  for (const item of ITEMS) {
    const quantity = overflow[item.id];
    if (!quantity) continue;
    const resolved = resolveCollision(x + 0.8 + index * 0.75, z, 0.3, extra);
    spots.push({
      itemId: item.id,
      name: item.name,
      quantity,
      x: resolved.x,
      z: resolved.z,
    });
    index += 1;
  }
  return spots;
}

export function planDemolish(state: BuildSession, id: string): DemolishPlan {
  const facility = state.buildings.find((building) => building.id === id);
  if (!facility) return emptyPlan("找不到設施", id);
  if (facility.hp <= 0) return emptyPlan("設施已摧毀", id);
  const refund = halfRefund(facility.kind);
  const seen = intakePreview(state.slots, BAG_CAPACITY, refund);
  const filled = fillSlots(state.slots, refund);
  if (!sameBag(seen.accepted, filled.accepted) || !sameBag(seen.left, filled.left)) {
    return emptyPlan("預覽與結算不一致", id);
  }
  const extra = state.buildings
    .filter((building) => building.id !== id && building.hp > 0)
    .map(facilityAabb);
  const lines = ITEMS.flatMap((item) => {
    const quantity = refund[item.id];
    return quantity ? [{ itemId: item.id, name: item.name, quantity }] : [];
  });
  return {
    ok: true,
    reason: null,
    id,
    refund,
    lines,
    accepted: filled.accepted,
    overflow: filled.left,
    spots: overflowSpots(filled.left, facility.x, facility.z, extra),
  };
}

export function requestDemolish(state: BuildSession, id: string): {
  state: BuildSession;
  plan: DemolishPlan;
} {
  const plan = planDemolish(state, id);
  if (!plan.ok) return { state: { ...state, demolishId: null }, plan };
  return { state: { ...state, demolishId: id }, plan };
}

export function cancelDemolish(state: BuildSession): BuildSession {
  return { ...state, demolishId: null };
}

export function confirmDemolish(state: BuildSession): {
  state: BuildSession;
  applied: boolean;
  plan: DemolishPlan;
} {
  if (!state.demolishId) return { state, applied: false, plan: emptyPlan("尚未確認拆除") };
  const plan = planDemolish(state, state.demolishId);
  if (!plan.ok || !plan.id) {
    return { state: { ...state, demolishId: null }, applied: false, plan };
  }
  const filled = fillSlots(state.slots, plan.refund);
  if (!sameBag(filled.accepted, plan.accepted) || !sameBag(filled.left, plan.overflow)) {
    return {
      state,
      applied: false,
      plan: emptyPlan("預覽與結算不一致", plan.id),
    };
  }
  return {
    state: {
      ...state,
      slots: filled.slots,
      buildings: state.buildings.filter((building) => building.id !== plan.id),
      demolishId: null,
    },
    applied: true,
    plan,
  };
}

export function listFacilities(
  state: BuildSession,
  fromX: number,
  fromZ: number,
): FacilityListItem[] {
  return state.buildings
    .filter((building) => building.hp > 0)
    .map((building) => {
      const recipe = RECIPES.find((item) => item.id === building.kind);
      return {
        id: building.id,
        kind: building.kind,
        name: recipe?.name ?? building.kind,
        purpose: recipe?.description ?? "",
        x: building.x,
        z: building.z,
        durability: building.hp,
        maxDurability: building.maxHp,
        distance: Math.hypot(building.x - fromX, building.z - fromZ),
      };
    })
    .sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function locateFacility(state: BuildSession, id: string, fromX: number, fromZ: number) {
  const found = listFacilities(state, fromX, fromZ).find((item) => item.id === id);
  if (!found) return null;
  return { id: found.id, x: found.x, z: found.z, distance: found.distance };
}

/** One event id reduces durability once. At zero the facility leaves the live set. */
export function strikeFacility(
  state: BuildSession,
  id: string,
  amount: number,
  eventId: string,
): BuildSession {
  if (state.settledEvents.includes(eventId)) return state;
  if (!Number.isFinite(amount) || amount <= 0) return state;
  let found = false;
  const buildings = state.buildings.map((building) => {
    if (building.id !== id || building.hp <= 0) return building;
    found = true;
    return { ...building, hp: Math.max(0, building.hp - amount) };
  });
  if (!found) return state;
  return { ...state, buildings, settledEvents: [...state.settledEvents, eventId] };
}

function finite(value: unknown, fallback = 0, max = 1_000_000) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(0, value))
    : fallback;
}

/**
 * Mirrors the unexported v2 restore filter: quarter turns, cap, doors ignored.
 * Integration still has to compare this with a real save through store.
 */
export function restoreLegacyFacilities(raw: unknown): SessionFacility[] {
  const result: SessionFacility[] = [];
  if (!Array.isArray(raw)) return result;
  for (const entry of raw.slice(0, FACILITY_CAP)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string") continue;
    if (result.some((building) => building.id === record.id)) continue;
    if (!RECIPES.some((recipe) => recipe.id === record.kind)) continue;
    const kind = record.kind as BuildKind;
    const rotation =
      (Math.round(finite(record.rotation, 0, Math.PI * 2) / (Math.PI / 2)) * Math.PI) / 2;
    const x = typeof record.x === "number" ? record.x : Number.NaN;
    const z = typeof record.z === "number" ? record.z : Number.NaN;
    const prior = result.map((building) => ({
      id: building.id,
      kind: building.kind,
      x: building.x,
      z: building.z,
      rotation: building.rotation,
      hp: building.hp,
    }));
    if (validatePlacement(kind, x, z, rotation, prior, undefined, false)) continue;
    const recipe = RECIPES.find((item) => item.id === kind)!;
    result.push({
      id: record.id.slice(0, 80),
      kind,
      x,
      z,
      rotation,
      hp: Math.max(1, finite(record.hp, 100, recipe.health)),
      maxHp: recipe.health,
    });
  }
  return result;
}

export { BAG_CAPACITY, BUILD_NEED_MATERIALS, PLACE_LEGAL_WORD };
