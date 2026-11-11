import type { CSSProperties, ReactNode } from "react";
import { pressAttrs, type PressState } from "../chrome.ts";
import type { CssRect } from "../touch-layout.ts";
import type { KeyboardOpenLayout } from "./keyboard.ts";
import type { MobileHudModel } from "./layout.ts";
import { meterLivePolicy } from "./notices.ts";
import { MOBILE_PANELS, type MobilePanelId, type MobilePanelSpec } from "./panels.ts";
import type { CompactStatus } from "./status-readout.ts";
import "./mobile.css";

function box(rect: CssRect): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.w, height: rect.h };
}

function Hit({
  id,
  rect,
  label,
  state = "ready",
  className,
  children,
}: {
  id?: string;
  rect: CssRect;
  label: string;
  state?: PressState;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      className={"tk-mobile-hit" + (className ? " " + className : "")}
      style={box(rect)}
      aria-label={label}
      {...pressAttrs("button", state)}
    >
      {children ?? label}
    </button>
  );
}

/** Presentational phone HUD. The host supplies layout rectangles and panel bodies. */
export function MobileHud({
  hud,
  status,
  notice = "",
  press = "ready",
}: {
  hud: MobileHudModel;
  status: CompactStatus;
  notice?: string;
  press?: PressState;
}) {
  const live = meterLivePolicy(notice ? "toast" : "life");
  const opener = (id: MobilePanelId) => MOBILE_PANELS.find((panel) => panel.id === id);
  const inTray = new Set(hud.launchers.map((item) => item.id));
  const mapOnScreen = inTray.has("map");
  return (
    <div className="tk-mobile" data-mobile-root="true">
      <div className="tk-mobile-status" style={box(hud.status)}>
        <b>{status.visibleLife}</b>
        <b>{status.visibleFocus}</b>
        <b>{status.visibleLevel}</b>
        <span>{status.visibleSave}</span>
        <span className="tk-mobile-sr">{status.ariaLife}</span>
        <span className="tk-mobile-sr">{status.ariaFocus}</span>
        <span className="tk-mobile-sr">{status.ariaLevel}</span>
        <span className="tk-mobile-sr">{status.ariaSave}</span>
      </div>
      <Hit
        id={mapOnScreen ? undefined : opener("map")?.restoreFocusId}
        rect={hud.minimap}
        label="校園地圖"
        state={press}
      />
      <div className="tk-mobile-hit tk-mobile-look" style={box(hud.look)} aria-hidden="true" />
      <div className="tk-mobile-hit" style={box(hud.stick)} aria-label="移動搖桿" {...pressAttrs("button", press)}>
        移動搖桿
      </div>
      <Hit rect={hud.sprint} label="奔跑" state={press} />
      <Hit rect={hud.dodge} label="閃避" state={press} />
      <Hit rect={hud.interact} label="互動" state={press} />
      <Hit id="tk-mobile-attack" rect={hud.attack} label="普攻" state={press} />
      <Hit id="tk-mobile-skill" rect={hud.skill} label="技能" state={press} />
      <Hit rect={hud.quickDodge} label="閃避" state={press} />
      <Hit rect={hud.coffee} label="咖啡" state={press} />
      <Hit rect={hud.tea} label="茶" state={press} />
      {hud.launchers.map((item) => (
        <Hit
          key={item.id}
          id={opener(item.id)?.restoreFocusId}
          rect={item.rect}
          label={opener(item.id)?.title ?? item.id}
          state={press}
        />
      ))}
      {hud.tray ? (
        <div className="tk-mobile-tray tk-mobile-hit" style={box(hud.tray)}>
          {MOBILE_PANELS.filter((panel) => !inTray.has(panel.id)).map((panel) => (
            <button
              key={panel.id}
              id={panel.restoreFocusId}
              type="button"
              {...pressAttrs("button", press)}
            >
              {panel.title}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="tk-mobile-hit tk-mobile-notice"
        style={box(hud.notice)}
        aria-live={live.ariaLive}
      >
        {notice}
      </div>
      <Hit id="tk-mobile-place" rect={hud.place} label="放置" state={press} />
      <Hit id="tk-mobile-rotate" rect={hud.rotate} label="旋轉" state={press} />
      <Hit id="tk-mobile-finish" rect={hud.finish} label="結束建造" state={press} />
    </div>
  );
}

/** Shared panel chrome: its own scrollport and a visible close control. */
export function MobilePanelShell({
  spec,
  onClose,
  children,
}: {
  spec: MobilePanelSpec;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <section
      className="tk-mobile tk-mobile-panel"
      role="dialog"
      aria-modal="true"
      aria-label={spec.title}
      data-restore-focus={spec.restoreFocusId}
    >
      <button
        id={spec.closeId}
        type="button"
        className="tk-mobile-close"
        {...pressAttrs("button", "ready")}
        onClick={onClose}
      >
        關閉
      </button>
      <div id={spec.scrollId} className="tk-mobile-scroll">
        {children}
      </div>
    </section>
  );
}

/** Confirm and close stay in the visible band above the keyboard. */
export function DepartmentSearchChrome({
  layout,
  onConfirm,
  onClose,
  children,
}: {
  layout: KeyboardOpenLayout;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="tk-mobile" data-keyboard-open={layout.keyboardOpen ? "true" : "false"} data-hotkeys-suspended={layout.hotkeysSuspended ? "true" : "false"}>
      {layout.search ? (
        <input
          id="tk-mobile-department-search"
          className="tk-mobile-hit"
          style={box(layout.search)}
          aria-label="搜尋科系"
          data-hotkey="none"
        />
      ) : null}
      <div id="tk-mobile-scroll-department" className="tk-mobile-scroll tk-mobile-abs" style={box(layout.scroll)}>
        {children}
      </div>
      <button
        id="tk-mobile-department-confirm"
        type="button"
        className="tk-mobile-hit tk-mobile-confirm"
        style={box(layout.confirm)}
        {...pressAttrs("button", "ready")}
        onClick={onConfirm}
      >
        確認
      </button>
      <button
        id="tk-mobile-close-department"
        type="button"
        className="tk-mobile-hit tk-mobile-close"
        style={box(layout.close)}
        {...pressAttrs("button", "ready", "cancel")}
        onClick={onClose}
      >
        關閉
      </button>
    </div>
  );
}
