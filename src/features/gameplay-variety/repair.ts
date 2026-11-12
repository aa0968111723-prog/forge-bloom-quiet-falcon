import type { RepairBoard, RepairConfig } from "./types.ts";

const PARTS = [
  { id: "cooler", name: "冷卻片" },
  { id: "battery", name: "電池" },
  { id: "antenna", name: "天線" },
];

export function buildRepair(config: RepairConfig, peace: boolean): RepairBoard {
  const slots = config.slotNames.map(() => null as string | null);
  const parts = peace ? PARTS : [...PARTS, { id: "scrap", name: "戰鬥留下的碎片" }];
  if (peace) {
    const coolerSlot = config.slotNames.findIndex((_, index) => Math.abs(index - config.heat) === 1);
    if (coolerSlot >= 0) slots[coolerSlot] = "cooler";
  }
  return {
    board: "repair",
    parts,
    slots,
    slotNames: [...config.slotNames],
    heat: config.heat,
  };
}

export function repairVerdict(board: RepairBoard): { ok: boolean; reason: string } {
  const placed = board.slots.filter((id): id is string => Boolean(id));
  if (placed.includes("scrap")) return { ok: false, reason: "碎片不能裝回去。" };
  if (board.slots[board.heat]) return { ok: false, reason: "熱源那一格要留空。" };
  const needed = ["cooler", "battery", "antenna"];
  for (const id of needed) {
    if (placed.filter((part) => part === id).length !== 1) {
      return { ok: false, reason: "冷卻片、電池、天線都要各裝一次。" };
    }
  }
  const batteryAt = board.slots.indexOf("battery");
  const coolerAt = board.slots.indexOf("cooler");
  if (Math.abs(batteryAt - board.heat) <= 1) return { ok: false, reason: "電池不能靠著熱源。" };
  if (Math.abs(coolerAt - board.heat) !== 1) return { ok: false, reason: "冷卻片要貼著熱源。" };
  return { ok: true, reason: "線路接上了。" };
}
