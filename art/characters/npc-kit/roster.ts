/**
 * The game's NPC roster, one preset per walker in src/game/Npcs.tsx (same
 * order as its PATHS). Each preset is a distinct person: face, hair, top,
 * bottom, shoes and accessories differ, not just a shirt colour.
 * Roles describe who would plausibly walk that route; they are game fiction.
 */
import { SLOT } from "./parts.ts";

export type NpcPreset = {
  id: string;
  route: string;
  role: string;
  parts: string[];
  /** Tint per slot (see SLOT); unlisted slots stay white. */
  colors: Partial<Record<keyof typeof SLOT, string>>;
  build: { height: number; chest: [number, number, number] };
};

const SKIN = { light: "#ffffff", warm: "#f4e2d4", tan: "#dcbca4" };

export const NPC_ROSTER: NpcPreset[] = [
  {
    id: "avenue-freshman",
    route: "宮燈大道石板步道往返",
    role: "大一新生，抱著課本趕課",
    parts: ["head:soft", "hair:ponytail", "top:cardigan", "bottom:skirt", "legs:bare", "socks:knee", "shoes:loafer", "acc:tote"],
    colors: { skin: SKIN.light, hair: "#5b3a2c", top: "#efe2c6", top2: "#ffffff", bottom: "#2f3d5c", socks: "#f6f4ef", shoe: "#5a3a2a", acc: "#d8b45c", acc2: "#e9e1d0" },
    build: { height: 0.97, chest: [0.94, 1, 0.95] },
  },
  {
    id: "colonnade-architect",
    route: "宮燈教室西側迴廊",
    role: "建築系學長，背著圖筒",
    parts: ["head:sharp", "hair:crop", "acc:glasses", "top:shirt", "arms:bare", "bottom:slacks", "shoes:loafer", "acc:tube"],
    colors: { skin: SKIN.warm, hair: "#2a2322", top: "#a9c7e2", bottom: "#4a4c55", shoe: "#2c2624", acc: "#46705d", acc2: "#3a2a22" },
    build: { height: 1.05, chest: [1.02, 1, 1.0] },
  },
  {
    id: "plaza-linguist",
    route: "書卷廣場菱形繞行",
    role: "外語系同學，戴著耳罩式耳機",
    parts: ["head:soft", "hair:bob", "acc:earphones", "top:hoodie", "bottom:jeans", "shoes:sneaker"],
    colors: { skin: SKIN.light, hair: "#4a2a24", top: "#d9a3a8", top2: "#ffffff", bottom: "#ffffff", shoe: "#ffffff", shoeAccent: "#c77f8a", acc: "#f2f0ea" },
    build: { height: 0.98, chest: [1, 1, 1] },
  },
  {
    id: "library-researcher",
    route: "圖書館前庭到海豚圓環",
    role: "研究生，長髮戴眼鏡，往返圖書館",
    parts: ["head:soft", "hair:long", "acc:glasses", "top:cardigan", "bottom:jeans", "shoes:sneaker"],
    colors: { skin: SKIN.warm, hair: "#1f1a1a", top: "#2f3f5f", top2: "#f2eee6", bottom: "#d9dde8", shoe: "#ffffff", shoeAccent: "#2f3f5f", acc2: "#6b4a34" },
    build: { height: 1.0, chest: [0.97, 1, 0.97] },
  },
  {
    id: "kenan-athlete",
    route: "克難坡上下來回",
    role: "體育課學生，運動外套與水壺",
    parts: ["head:sharp", "hair:crop", "acc:cap", "top:track", "bottom:track", "shoes:sneaker", "acc:bottle"],
    colors: { skin: SKIN.tan, hair: "#3a2a24", top: "#4f8f78", stripe: "#ffffff", bottom: "#28324a", shoe: "#ffffff", shoeAccent: "#4f8f78", acc: "#f3efe4", acc2: "#ffffff" },
    build: { height: 1.04, chest: [1.1, 1, 1.07] },
  },
];
