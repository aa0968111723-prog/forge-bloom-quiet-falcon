/**
 * One dialog stack for department, settings, backpack, map, plaque, and victory.
 * The node test calls these functions with the elements it supplies; React dialogs
 * call the same functions, so focus, inert, Tab, and Escape stay on one path.
 */
export type DialogHost = {
  root: HTMLElement;
  scrim: HTMLElement;
  close: () => void;
};

type Layer = DialogHost & {
  trigger: HTMLElement | null;
  releaseInert: () => void;
  onKey: (event: KeyboardEvent) => void;
};

const stack: Layer[] = [];

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';

export function dialogDepth() {
  return stack.length;
}

export function filterDepartments<T extends { name: string; college: string }>(
  departments: readonly T[],
  search: string,
  college: string,
): T[] {
  return departments.filter(
    (department) =>
      (college === "全部" || department.college === college) &&
      department.name.includes(search),
  );
}

function releasePointerLock() {
  if (typeof document === "undefined" || !document.pointerLockElement) return;
  document.exitPointerLock?.();
}

function isEnabled(el: HTMLElement) {
  return !("disabled" in el && Boolean((el as HTMLButtonElement).disabled));
}

function canFocus(el: HTMLElement) {
  const tag = el.tagName;
  if (tag === "BUTTON" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA")
    return true;
  if (tag === "A") return el.hasAttribute("href");
  return el.getAttribute("tabindex") === "0";
}

export function listFocusable(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (!canFocus(el) || !isEnabled(el)) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (typeof el.getClientRects === "function" && el.getClientRects().length === 0)
      return false;
    return true;
  });
}

function focusInside(root: HTMLElement) {
  const body = root.querySelector<HTMLElement>(".ad-dialog-body");
  const inBody = body ? listFocusable(body) : [];
  const target = inBody[0] ?? listFocusable(root)[0];
  target?.focus();
}

function holdInert(scrim: HTMLElement) {
  const parent = scrim.parentElement;
  const touched: HTMLElement[] = [];
  if (!parent) return () => {};
  for (const child of [...parent.children]) {
    if (child === scrim) continue;
    const el = child as HTMLElement;
    if (el.inert) continue;
    el.inert = true;
    touched.push(el);
  }
  return () => {
    for (const el of touched) el.inert = false;
  };
}

function finish(layer: Layer) {
  const index = stack.indexOf(layer);
  if (index < 0) return;
  stack.splice(index, 1);
  layer.root.removeEventListener("keydown", layer.onKey);
  layer.releaseInert();
  if (layer.trigger && layer.trigger.isConnected !== false)
    layer.trigger.focus();
}

/** Push a layer, release pointer lock, inert what is behind the scrim, and focus inside. */
export function openDialog(host: DialogHost) {
  releasePointerLock();
  const active = document.activeElement as HTMLElement | null;
  const trigger =
    active && typeof active.focus === "function" ? active : null;
  const layer = {
    ...host,
    trigger,
    releaseInert: holdInert(host.scrim),
    onKey: (event: KeyboardEvent) => {
      cycleDialogFocus(event);
    },
  } satisfies Layer;
  stack.push(layer);
  host.root.addEventListener("keydown", layer.onKey);
  focusInside(host.root);
  return () => finish(layer);
}

function isEscape(event: { key?: string; code?: string }) {
  return event.key === "Escape" || event.code === "Escape";
}

/** Close only the top layer. A select or an IME composition keeps the layer. */
export function dismissTopDialog(event: KeyboardEvent) {
  const top = stack.at(-1);
  if (!top || !isEscape(event)) return false;
  if (event.isComposing || event.keyCode === 229) return false;
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === "SELECT") return false;
  event.preventDefault();
  event.stopPropagation();
  top.close();
  return true;
}

/** Wrap Tab at the ends of the top dialog. Returns false when Tab should move natively. */
export function cycleDialogFocus(event: KeyboardEvent) {
  const top = stack.at(-1);
  if (!top || event.key !== "Tab") return false;
  const list = listFocusable(top.root);
  if (!list.length) return false;
  const active = (event.target as HTMLElement | null) ?? null;
  const first = list[0];
  const last = list[list.length - 1];
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
