import { dismissTopDialog } from "./dialog";

export type Tap = "interact" | "dodge" | "pause";

export type TouchZone = "stick" | "look" | "sprint" | "dodge" | "interact";

export type PointerEndKind = "up" | "cancel" | "lost";

/** Pixels from the stick origin that count as a full deflection. */
export const STICK_RADIUS = 38;

export type Actions = {
  moveX: number;
  moveY: number;
  sprint: boolean;
  /** Look pixels consumed by this sample. Mouse and touch share this pair. */
  lookX: number;
  lookY: number;
  /** True when this sample consumed at least one completed tap. */
  interact: boolean;
  pause: boolean;
  dodge: boolean;
  interactCount: number;
  pauseCount: number;
  dodgeCount: number;
};

const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "KeyE",
  "KeyF",
  "Escape",
]);

function radialDeadzone(x: number, y: number, dz = 0.16) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

export class InputManager {
  keys = new Set<string>();
  inject: string[] | null = null;
  lookX = 0;
  lookY = 0;
  joyX = 0;
  joyY = 0;
  /** Sprint held by a touch finger. Keyboard Shift stays in `keys`. */
  touchSprint = false;
  prevInteract = false;
  prevPause = false;
  prevDodge = false;
  /** Completed one-shot taps waiting for the next sample, in press order. */
  private shots: Tap[] = [];
  private fingers = new Map<number, { zone: TouchZone; x: number; y: number }>();
  private attached = false;

  attach() {
    if (this.attached || typeof window === "undefined") return;
    this.attached = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("mousemove", this.onMouse, { passive: true });
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("mousemove", this.onMouse);
    this.keys.clear();
    this.clearShots();
    this.lookX = 0;
    this.lookY = 0;
    this.releaseTouch();
  }

  /** One completed press, shared by physical keys and screen buttons. */
  tap(action: Tap) {
    this.shots.push(action);
  }

  /**
   * Remember one captured finger. Dodge and interact queue a single tap.
   * Sprint sets the touch hold and does not press Shift.
   */
  pointerDown(id: number, zone: TouchZone, x: number, y: number) {
    this.fingers.set(id, { zone, x, y });
    if (zone === "sprint") this.touchSprint = true;
    if (zone === "dodge") this.tap("dodge");
    if (zone === "interact") this.tap("interact");
  }

  /**
   * Stick vectors stay relative to the pointerdown origin, so a rotation
   * keeps a continuous direction. Look only adds while that finger is live.
   */
  pointerMove(id: number, x: number, y: number) {
    const finger = this.fingers.get(id);
    if (!finger) return null;
    if (finger.zone === "stick") {
      let dx = x - finger.x;
      let dy = y - finger.y;
      const dist = Math.hypot(dx, dy);
      if (dist > STICK_RADIUS) {
        dx = (dx / dist) * STICK_RADIUS;
        dy = (dy / dist) * STICK_RADIUS;
      }
      this.joyX = dx / STICK_RADIUS;
      this.joyY = -dy / STICK_RADIUS;
      return { x: dx, y: dy };
    }
    if (finger.zone === "look") {
      this.lookX += x - finger.x;
      this.lookY += y - finger.y;
      finger.x = x;
      finger.y = y;
    }
    return null;
  }

  /**
   * Pointer up, pointer cancel, and lost pointer capture all release only
   * this finger. Another finger and any key still physically held stay.
   */
  pointerEnd(id: number, _kind: PointerEndKind): TouchZone | null {
    const finger = this.fingers.get(id);
    if (!finger) return null;
    this.fingers.delete(id);
    if (finger.zone === "stick" && !this.hasZone("stick")) {
      this.joyX = 0;
      this.joyY = 0;
    }
    if (finger.zone === "sprint" && !this.hasZone("sprint")) {
      this.touchSprint = false;
    }
    return finger.zone;
  }

  /** Drop every touch finger. Keyboard keys are left as they are. */
  releaseTouch() {
    this.fingers.clear();
    this.joyX = 0;
    this.joyY = 0;
    this.touchSprint = false;
  }

  consumeLook() {
    const x = this.lookX;
    const y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    return { x, y };
  }

  sample(): Actions {
    const lookX = this.lookX;
    const lookY = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    const has = (c: string) =>
      this.inject ? this.inject.includes(c) : this.keys.has(c);

    let moveX = 0;
    let moveY = 0;
    if (has("KeyD") || has("ArrowRight")) moveX += 1;
    if (has("KeyA") || has("ArrowLeft")) moveX -= 1;
    if (has("KeyW") || has("ArrowUp")) moveY += 1;
    if (has("KeyS") || has("ArrowDown")) moveY -= 1;

    const pads =
      typeof navigator !== "undefined" ? (navigator.getGamepads?.() ?? []) : [];
    for (const pad of pads) {
      if (!pad || pad.mapping !== "standard") continue;
      const stick = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      moveX += stick.x;
      moveY += -stick.y;
      if (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed) {
        /* sprint via A / RT */
      }
    }

    moveX += this.joyX;
    moveY += this.joyY;

    const mag = Math.hypot(moveX, moveY);
    if (mag > 1) {
      moveX /= mag;
      moveY /= mag;
    }

    const sprint =
      has("ShiftLeft") ||
      has("ShiftRight") ||
      this.touchSprint ||
      pads.some(
        (p) => p && (p.buttons[0]?.pressed || (p.buttons[7]?.value ?? 0) > 0.4),
      );

    const waiting = this.shots;
    this.shots = [];
    const pulled = (action: Tap) =>
      waiting.reduce((n, shot) => n + (shot === action ? 1 : 0), 0);
    // A held level that never passed through tap() — injected keys — still
    // counts as one edge. Taps already queued are not counted again.
    const edge = (queued: number, held: boolean, prev: boolean) =>
      queued + (held && !prev && queued === 0 ? 1 : 0);
    const interactHeld = has("KeyE") || has("KeyF");
    const pauseHeld = has("Escape");
    const dodgeHeld = has("Space");
    const interactCount = edge(pulled("interact"), interactHeld, this.prevInteract);
    const pauseCount = edge(pulled("pause"), pauseHeld, this.prevPause);
    const dodgeCount = edge(pulled("dodge"), dodgeHeld, this.prevDodge);
    this.prevInteract = interactHeld;
    this.prevPause = pauseHeld;
    this.prevDodge = dodgeHeld;
    return {
      moveX,
      moveY,
      sprint,
      lookX,
      lookY,
      interact: interactCount > 0,
      pause: pauseCount > 0,
      dodge: dodgeCount > 0,
      interactCount,
      pauseCount,
      dodgeCount,
    };
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.isComposing || e.keyCode === 229) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName ?? "";
    const space = e.code === "Space" || e.key === " ";
    const enter = e.code === "Enter" || e.key === "Enter";
    const escape = e.code === "Escape" || e.key === "Escape";
    if (tag === "SELECT" && (space || escape)) return;
    if (tag === "BUTTON" && (space || enter)) return;
    if (
      !escape &&
      (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
    )
      return;
    if (escape && dismissTopDialog(e)) return;
    this.keys.add(e.code);
    if (e.code === "KeyE" || e.code === "KeyF") this.tap("interact");
    if (e.code === "Escape") this.tap("pause");
    if (e.code === "Space") this.tap("dodge");
    if (
      GAME_KEYS.has(e.code) &&
      !["INPUT", "TEXTAREA"].includes(
        (e.target as HTMLElement | null)?.tagName ?? "",
      )
    ) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  /** Drop a queued tap. A relocate also forgets held movement. */
  releaseEdges(movement = false) {
    this.shots = [];
    this.prevInteract = true;
    this.prevPause = true;
    this.prevDodge = true;
    this.lookX = 0;
    this.lookY = 0;
    this.releaseTouch();
    if (movement) {
      this.keys.clear();
      this.inject = null;
      return;
    }
    for (const code of ["Space", "KeyE", "KeyF", "KeyQ", "KeyJ"])
      this.keys.delete(code);
  }

  private clearShots() {
    this.shots = [];
    this.prevInteract = false;
    this.prevPause = false;
    this.prevDodge = false;
  }

  private clear = () => {
    this.keys.clear();
    this.clearShots();
    this.lookX = 0;
    this.lookY = 0;
    this.releaseTouch();
  };

  private hasZone(zone: TouchZone) {
    for (const finger of this.fingers.values()) {
      if (finger.zone === zone) return true;
    }
    return false;
  }

  private onVis = () => {
    if (document.hidden) this.clear();
  };

  private onMouse = (e: MouseEvent) => {
    if (document.pointerLockElement) {
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    }
  };
}

export const input = new InputManager();
