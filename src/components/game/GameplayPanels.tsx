import { Backpack, Heart, Hammer, Swords } from "lucide-react";
import { BUILD_CATALOG, BUILD_KINDS, type BuildKind } from "@/game/building.ts";
import { ENEMY_LABEL, playerMaxHp } from "@/game/combat.ts";
import { COLLEGES, departmentById, departmentsInCollege } from "@/game/departments.ts";
import { ITEM_CATALOG, USABLE_ITEMS, listItems, usedSlots } from "@/game/inventory.ts";
import { useGame } from "@/game/store";
import { ENEMY_SPAWN_BY_ID } from "@/game/world-data/encounters.ts";
import { cn } from "@/lib/cn";

export function HpHud() {
  const hp = useGame((s) => s.playerHp);
  const departmentId = useGame((s) => s.departmentId);
  const max = playerMaxHp(departmentId);
  const pct = max <= 0 ? 0 : Math.round((hp / max) * 100);
  return (
    <div className="tk-panel flex items-center gap-2 rounded-xl px-2.5 py-2">
      <Heart className="size-4 text-vermilion" />
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink/15 sm:w-28">
        <div className="h-full bg-vermilion" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-ink">
        {hp}/{max}
      </span>
    </div>
  );
}

export function PlayTools({ coarse }: { coarse: boolean }) {
  const hud = useGame((s) => s.hud);
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={cn("tk-btn tk-btn-on-dark size-11 min-h-11 p-0", hud === "backpack" && "bg-paper text-ink")}
        aria-label="背包"
        onClick={() => useGame.getState().toggleHud("backpack")}
      >
        <Backpack className="size-4" />
      </button>
      <button
        type="button"
        className={cn("tk-btn tk-btn-on-dark size-11 min-h-11 p-0", hud === "build" && "bg-paper text-ink")}
        aria-label="建造"
        onClick={() => useGame.getState().toggleHud("build")}
      >
        <Hammer className="size-4" />
      </button>
      {coarse && (
        <button
          type="button"
          className="tk-btn tk-btn-on-dark size-11 min-h-11 p-0"
          aria-label="攻擊"
          onClick={() => useGame.getState().strikeNearby()}
        >
          <Swords className="size-4" />
        </button>
      )}
    </div>
  );
}

export function NearbyCombat() {
  const nearbyEnemyId = useGame((s) => s.nearbyEnemyId);
  const enemies = useGame((s) => s.enemies);
  const hud = useGame((s) => s.hud);
  const spawn = nearbyEnemyId ? ENEMY_SPAWN_BY_ID[nearbyEnemyId] : null;
  if (!spawn || hud !== "none") return null;
  const hp = enemies[spawn.id] ?? 0;
  if (hp <= 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-52 left-1/2 w-[min(92vw,26rem)] -translate-x-1/2 sm:bottom-24">
      <div className="tk-panel rounded-2xl px-4 py-3 text-center">
        <p className="text-xs tracking-[0.2em] text-muted">{ENEMY_LABEL[spawn.kind]}</p>
        <p className="font-display text-xl text-ink">{spawn.name}</p>
        <p className="mt-1 text-xs tabular-nums text-muted">
          HP {hp} · 按 Q 應戰
        </p>
      </div>
    </div>
  );
}

export function BackpackPanel() {
  const inventory = useGame((s) => s.inventory);
  const departmentId = useGame((s) => s.departmentId);
  const dept = departmentById(departmentId);
  const items = listItems(inventory);
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-navy-deep/45 p-4 sm:items-center">
      <div className="tk-panel w-full max-w-md rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink">背包</h2>
            <p className="mt-1 text-sm text-muted">
              {usedSlots(inventory)}/{inventory.capacity} · {dept ? dept.name : "尚未選系"}
            </p>
          </div>
          <button type="button" className="tk-btn tk-btn-ghost h-10 min-h-10 px-3" onClick={() => useGame.getState().toggleHud("none")}>
            關閉
          </button>
        </div>
        <ul className="mt-4 space-y-1">
          {items.length === 0 && <li className="text-sm text-muted">空空如也</li>}
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm">
              <span>
                {ITEM_CATALOG[it.id].name}
                <span className="ml-2 tabular-nums text-muted">×{it.count}</span>
              </span>
              {USABLE_ITEMS.includes(it.id) && (
                <button
                  type="button"
                  className="tk-btn tk-btn-ghost h-8 min-h-8 px-2 text-xs"
                  onClick={() => useGame.getState().useFromPack(it.id)}
                >
                  使用
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BuildPanel() {
  const buildKind = useGame((s) => s.buildKind);
  const inventory = useGame((s) => s.inventory);
  const bricks = inventory.items.find((i) => i.id === "brick")?.count ?? 0;
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-navy-deep/45 p-4 sm:items-center">
      <div className="tk-panel w-full max-w-md rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink">建造</h2>
            <p className="mt-1 text-sm text-muted">紅磚 ×{bricks} · 走到空地按 E 放置</p>
          </div>
          <button type="button" className="tk-btn tk-btn-ghost h-10 min-h-10 px-3" onClick={() => useGame.getState().toggleHud("none")}>
            關閉
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {BUILD_KINDS.map((id) => (
            <button
              key={id}
              type="button"
              className={cn("tk-btn tk-btn-ghost py-3 text-sm", buildKind === id && "bg-navy text-paper hover:bg-navy")}
              onClick={() => useGame.getState().setBuildKind(id as BuildKind)}
            >
              {BUILD_CATALOG[id].name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="tk-btn tk-btn-primary mt-4 w-full"
          onClick={() => useGame.getState().tryPlaceHere()}
        >
          在此放置
        </button>
      </div>
    </div>
  );
}

export function SetupPanel() {
  return (
    <div className="pointer-events-auto flex h-full items-end justify-center bg-gradient-to-t from-navy-deep via-navy-deep/70 to-transparent p-4 pb-10 sm:items-center">
      <div className="tk-panel max-h-[85vh] w-full max-w-2xl overflow-auto rounded-3xl p-5 sm:p-7">
        <p className="text-[11px] tracking-[0.42em] text-muted">TAMKANG · MAJOR</p>
        <h2 className="mt-1 font-display text-3xl text-ink">選擇科系</h2>
        <p className="mt-2 text-sm text-muted">九個學院的代表學系會改變戰鬥、背包容量或建造距離。</p>
        <div className="mt-4 space-y-4">
          {COLLEGES.map((college) => (
            <div key={college.id}>
              <p className="text-xs font-medium tracking-[0.16em] text-muted">{college.name}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {departmentsInCollege(college.id).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="tk-btn tk-btn-ghost py-2 text-sm"
                    onClick={() => useGame.getState().selectDepartment(d.id)}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DefeatPanel() {
  const downed = useGame((s) => s.downed);
  if (!downed) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-navy-deep/60 p-4">
      <div className="tk-panel w-full max-w-sm rounded-3xl p-6 text-center">
        <p className="font-display text-3xl text-ink">被當掉了</p>
        <p className="mt-2 text-sm text-muted">考試、報告或異象把體力打空。從克難坡再出發。</p>
        <button type="button" className="tk-btn tk-btn-primary mt-5 w-full" onClick={() => useGame.getState().respawn()}>
          重新出發
        </button>
      </div>
    </div>
  );
}
