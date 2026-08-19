import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

/**
 * Canvas-drawn signage.
 *
 * Campus signs carry Chinese text, so they are painted into a canvas texture at
 * runtime rather than baked. The cache is keyed on the full appearance, and it is
 * cleared once web fonts finish loading so the first paint does not leave the
 * whole campus labelled in a fallback face.
 */
const cache = new Map<string, THREE.CanvasTexture>();

export function makeCanvasTexture(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) paint(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export type SignStyle = {
  fg?: string;
  bg?: string;
  border?: string;
  width?: number;
  height?: number;
  /** Vertical text, as on the older campus posts. */
  vertical?: boolean;
};

export function makeSignTexture(text: string, style: SignStyle = {}) {
  const {
    fg = "#f3eee4",
    bg = "#1a3f6d",
    border = "#c9a227",
    width = 768,
    height = 192,
    vertical = false,
  } = style;
  const key = `${text}|${fg}|${bg}|${border}|${width}|${height}|${vertical}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = makeCanvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = Math.max(4, Math.round(Math.min(w, h) * 0.05));
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (vertical) {
      const size = Math.floor((h / text.length) * 0.8);
      ctx.font = `700 ${size}px "Noto Serif TC", "WenQuanYi Zen Hei", serif`;
      [...text].forEach((ch, i) => {
        ctx.fillText(ch, w / 2, ((i + 0.5) * h) / text.length);
      });
    } else {
      ctx.font = `700 ${Math.floor(h * 0.46)}px "Noto Serif TC", "WenQuanYi Zen Hei", serif`;
      ctx.fillText(text, w / 2, h / 2 + 4);
    }
  });
  cache.set(key, t);
  return t;
}

/** Re-paints signage after web fonts land, so no sign is left in a fallback face. */
export function useFontTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let gone = false;
    const kick = () => {
      if (gone) return;
      for (const t of cache.values()) t.dispose();
      cache.clear();
      setTick((n) => n + 1);
    };
    document.fonts?.ready.then(kick).catch(() => {});
    document.fonts?.addEventListener?.("loadingdone", kick);
    return () => {
      gone = true;
    };
  }, []);
  return tick;
}

export type CampusSignId =
  | "kenan"
  | "kenanSteps"
  | "avenue"
  | "statue"
  | "gate"
  | "dolphin"
  | "library"
  | "scroll"
  | "museum"
  | "gym"
  | "sing"
  | "tigers"
  | "palace"
  | "wayfinding";

/** All campus signage in one memoised set, rebuilt when fonts load. */
export function useCampusSigns(): Record<CampusSignId, THREE.Texture> {
  const tick = useFontTick();
  return useMemo(
    () => ({
      kenan: makeSignTexture("克難坡", { fg: "#f3eee4", bg: "#5c1812" }),
      kenanSteps: makeSignTexture("一百三十二階", { fg: "#f3eee4", bg: "#5c1812", width: 720, height: 160 }),
      avenue: makeSignTexture("宮燈大道", { fg: "#5c1812", bg: "#f3eee4" }),
      statue: makeSignTexture("功在作人", { fg: "#f3eee4", bg: "#3a2c1c", width: 640, height: 160 }),
      gate: makeSignTexture("淡江大學", { fg: "#1a3f6d", bg: "#f3eee4", width: 900, height: 200 }),
      dolphin: makeSignTexture("立足淡江 放眼世界", { fg: "#1a3f6d", bg: "#d8d3c8", width: 900, height: 160 }),
      library: makeSignTexture("覺生紀念圖書館", { fg: "#f3eee4", bg: "#1a3f6d", width: 980, height: 180 }),
      scroll: makeSignTexture("樸實剛毅", { fg: "#5c4a2c", bg: "#e8e0cc", width: 760, height: 180 }),
      museum: makeSignTexture("海事博物館", { fg: "#f3eee4", bg: "#1a3f6d", width: 900, height: 180 }),
      gym: makeSignTexture("紹謨紀念體育館", { fg: "#f3eee4", bg: "#1a3f6d", width: 900, height: 180 }),
      sing: makeSignTexture("唱自己的歌", { fg: "#f3eee4", bg: "#3a2c1c", width: 640, height: 160 }),
      tigers: makeSignTexture("五虎崗傳奇", { fg: "#f3eee4", bg: "#3a2c1c", width: 640, height: 160 }),
      palace: makeSignTexture("宮燈教室", { fg: "#f3eee4", bg: "#5c1812", width: 640, height: 160 }),
      wayfinding: makeSignTexture("圖書館 ↑", { fg: "#f3eee4", bg: "#245c3d", width: 640, height: 200 }),
    }),
    // `tick` is not read inside, but bumping it after fonts load is exactly the
    // trigger for rebuilding every sign texture with the real typeface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );
}
