export type MapIntent = "select" | "track" | "go";

const DRAG_SLOP = 6;

/**
 * Select, track, and go are taps.
 * A drag pans the map and never fast-travels, including when the pointer started on go.
 */
export function mapDragDecision(input: {
  intent: MapIntent;
  dragged?: boolean;
  distance?: number;
}): { action: MapIntent | "pan"; fastTravel: boolean } {
  const dragged = input.dragged === true || (input.distance ?? 0) >= DRAG_SLOP;
  if (dragged) return { action: "pan", fastTravel: false };
  if (input.intent === "go") return { action: "go", fastTravel: true };
  return { action: input.intent, fastTravel: false };
}
