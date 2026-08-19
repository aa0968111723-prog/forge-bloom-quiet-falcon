export type Actions = {
  moveX: number;
  moveY: number;
  sprint: boolean;
  interact: boolean;
  pause: boolean;
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
  const scale = ((m - dz) / (1 - dz)) / m;
  return { x: x * scale, y: y * scale };
}

export class InputManager {
  keys = new Set<string>();
  inject: string[] | null = null;
  lookX = 0;
  lookY = 0;
  joyX = 0;
  joyY = 0;
  prevInteract = false;
  prevPause = false;
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
  }

  consumeLook() {
    const x = this.lookX;
    const y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    return { x, y };
  }

  sample(): Actions {
    const src = this.inject ?? [...this.keys];
    const has = (c: string) => (this.inject ? this.inject.includes(c) : this.keys.has(c));

    let moveX = 0;
    let moveY = 0;
    if (has("KeyD") || has("ArrowRight")) moveX += 1;
    if (has("KeyA") || has("ArrowLeft")) moveX -= 1;
    if (has("KeyW") || has("ArrowUp")) moveY += 1;
    if (has("KeyS") || has("ArrowDown")) moveY -= 1;

    const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() ?? [] : [];
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
      pads.some((p) => p && (p.buttons[0]?.pressed || (p.buttons[7]?.value ?? 0) > 0.4));

    const interactHeld = has("KeyE") || has("KeyF") || has("Space");
    const pauseHeld = has("Escape");
    const interact = interactHeld && !this.prevInteract;
    const pause = pauseHeld && !this.prevPause;
    this.prevInteract = interactHeld;
    this.prevPause = pauseHeld;
    void src;

    return { moveX, moveY, sprint, interact, pause };
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys.add(e.code);
    if (GAME_KEYS.has(e.code) && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement | null)?.tagName ?? "")) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private clear = () => {
    this.keys.clear();
    this.joyX = 0;
    this.joyY = 0;
  };

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
