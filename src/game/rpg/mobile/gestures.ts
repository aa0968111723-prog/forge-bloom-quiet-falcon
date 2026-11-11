import type { MobileHudModel } from "./layout.ts";
import { pointIn } from "./rects.ts";

export type HudPointer = { id: number; x: number; y: number };

export type PointerSession = {
  pointers: HudPointer[];
  blurred: boolean;
};

export type SessionEvent =
  | { type: "down" | "move"; id: number; x: number; y: number }
  | { type: "up" | "cancel"; id: number }
  | { type: "blur" | "hidden" | "focus" };

export function idleSession(): PointerSession {
  return { pointers: [], blurred: false };
}

/** Drop every pointer on blur, hide, or cancel so a finger cannot stick. */
export function sessionEvent(session: PointerSession, event: SessionEvent): PointerSession {
  if (event.type === "blur" || event.type === "hidden") {
    return { pointers: [], blurred: true };
  }
  if (event.type === "focus") return { pointers: [], blurred: false };
  if (event.type === "up" || event.type === "cancel") {
    return {
      pointers: session.pointers.filter((pointer) => pointer.id !== event.id),
      blurred: false,
    };
  }
  if (event.type !== "down" && event.type !== "move") return session;
  const next = session.pointers.filter((pointer) => pointer.id !== event.id);
  next.push({ id: event.id, x: event.x, y: event.y });
  return { pointers: next, blurred: false };
}

export function sessionHolds(session: PointerSession, hud: MobileHudModel): {
  move: boolean;
  look: boolean;
  attack: boolean;
  stuck: boolean;
} {
  if (session.blurred) {
    return { move: false, look: false, attack: false, stuck: session.pointers.length > 0 };
  }
  const move = session.pointers.some((pointer) => pointIn(hud.stick, pointer.x, pointer.y));
  const look = session.pointers.some((pointer) => pointIn(hud.look, pointer.x, pointer.y));
  const attack = session.pointers.some((pointer) => pointIn(hud.attack, pointer.x, pointer.y));
  return { move, look, attack, stuck: false };
}
