import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  Backpack,
  BookOpen,
  Hammer,
  Map,
  Pause,
  Play,
  ArrowUpRight,
  GraduationCap,
  Shield,
  Sparkles,
  Download,
  Upload,
  ChevronUp,
  ChevronDown,
  Settings2,
  Compass,
  Heart,
  HeartCrack,
  HeartPulse,
  ArrowUp,
  CircleAlert,
  DraftingCompass,
  FlaskConical,
  ScrollText,
  Coins,
  Languages,
  Globe,
  Cpu,
  type LucideIcon,
} from "lucide-react";
import { useGame } from "../store";
import { quality } from "../quality";
import {
  CHROME_CONTROLS,
  chromeVars,
  pressAttrs,
  pressMark,
  signHost,
  type ChromeTier,
} from "./chrome";
import {
  LANDMARKS,
  LANDMARK_BY_ID,
  WORLD_BOUNDS,
} from "../world";
import { campusAudio } from "../audio";
import { GearDock } from "../../features/items-equipment-building/GearDock";
import { factOf } from "../../features/items-equipment-building/catalog";
import { slotCap } from "../../features/items-equipment-building/gear";
import { inventory, maxHp, promptSnap, useRpg, type RpgPanel } from "./store";
import { packView, type PackFilter, type PackSort } from "./pack";
import { itemDetail } from "./itemdetail";
import {
  DEPARTMENTS,
  DISCIPLINES,
  ITEMS,
  MISSIONS,
  RECIPES,
  missionProgress,
  ENEMY_TYPES,
  type Discipline,
} from "./data";
import { SKILL_GLYPH } from "./skill-glyph";
import {
  CAMPUS_ROADS,
  CAMPUS_SITES,
} from "./campus";
import { canPay, levelForXp } from "./rules";
import { buildCards } from "./buildcard";
import { holdLife, holdFocus, holdProgress, type StatusCueId } from "./status";
import { ZONE_MARK, ZONE_MARK_ORDER, zoneMark, zoneNear } from "./map-zones";
import { quickbarReadout, type QuickSlotView } from "./quickbar";
import { promptDecision } from "./prompts";
import { input, type PointerEndKind, type TouchZone } from "./input";
import { quickbarPlace, touchLayout, type CssRect, type QuickbarPlacement, type SafeInsets, type TouchLayout } from "./touch-layout";
import "./mobile/mobile.css";
import { compactStatus, isMobileViewport, mobileHudLayout, panelClosePlan, type MobileHudModel } from "./mobile";
import { mapDragDecision } from "./mobile/map-gesture";
import { AdventureCombatHud } from "./AdventureCombatHud";
import { usePerformance } from "./performance";
import { Dialog } from "./DialogFrame";
import { filterDepartments } from "./dialog";
import {
  applySettings,
  openSettings,
  returnFromSettings,
  settingsReturnLabel,
  settingsSurface,
  settingsVisible,
} from "./settings";
import {
  cancelImport,
  confirmImport,
  enterHome,
  exportHomeBackup,
  importChosenSave,
  readHome,
  stageImport,
} from "./home";
import { NarrativePanel } from "./NarrativePanel";
import {
  closeLessonReview,
  lessonReadout,
  observeSupply,
  openLessonReview,
  skipLesson,
} from "./lesson";
import { lessonMapLabel } from "./lesson-label";
import { semesterView } from "../contracts/semester.ts";
import { VarietyDock, VarietyPanel } from "../../features/gameplay-variety/VarietyChrome";
import { dismissVariety, varietyHeading } from "../../features/gameplay-variety/runtime";

const PANELS = [
  ["inventory", CHROME_CONTROLS.inventory, Backpack, "I"],
  ["skills", CHROME_CONTROLS.skills, GraduationCap, "K"],
  ["build", CHROME_CONTROLS.build, Hammer, "B"],
  ["journal", CHROME_CONTROLS.journal, BookOpen, "L"],
  ["map", CHROME_CONTROLS.map, Map, "M"],
] as const;
function DepartmentPanel() {
  const [search, setSearch] = useState(""),
    [college, setCollege] = useState("全部");
  const selected = useRpg((s) => s.departmentId);
  const lesson = useRpg((s) => s.lesson);
  const panel = useRpg((s) => s.panel);
  const playerX = useGame((s) => s.playerX);
  const playerZ = useGame((s) => s.playerZ);
  const list = filterDepartments(DEPARTMENTS, search, college);
  const readout = lesson === "department" ? lessonReadout() : null;
  return (
    <>
      {readout?.objective ? (
        <p className="ad-lesson-inline" data-at={`${playerX},${playerZ}`} data-panel={panel ?? ""}>
          <strong>{readout.objective}</strong>
          {readout.prompt ? <span>{readout.prompt}</span> : null}
        </p>
      ) : null}
      <p className="ad-lead">
        選擇你的主修，帶著知識探索五虎崗。技能效果為本遊戲的虛構設定。
      </p>
      <div className="ad-filter">
        <input
          aria-label="搜尋科系"
          placeholder="搜尋科系…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="篩選學院"
          value={college}
          onChange={(e) => setCollege(e.target.value)}
        >
          {["全部", ...new Set(DEPARTMENTS.map((d) => d.college))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="ad-departments">
        {list.map((d) => {
          const skill = DISCIPLINES[d.discipline];
          return (
            <button
              className={
                "ad-department " + (selected === d.id ? "selected" : "")
              }
              key={d.id}
              disabled={Boolean(selected)}
              onClick={() => {
                campusAudio.unlock();
                useRpg.getState().chooseDepartment(d.id);
              }}
            >
              <span
                className="ad-dept-mark"
                style={{ background: skill.color }}
              >
                <GraduationCap size={22} />
              </span>
              <span>
                <small>{d.college}</small>
                <strong>{d.name}</strong>
                <em>
                  {skill.skill} · {skill.label}
                </em>
              </span>
              <ArrowUpRight size={18} />
            </button>
          );
        })}
      </div>
      {list.length === 0 && (
        <p className="ad-empty">沒有符合的科系，試試其他名稱。</p>
      )}
      <p className="ad-footnote">
        科系名單參考淡江學術單位。每個學期選定一個主修，九類專業各有不同技能。
      </p>
      {readout ? (
        <button
          type="button"
          className="ad-raise"
          {...pressAttrs("button", "ready")}
          onClick={() => skipLesson()}
        >
          略過
        </button>
      ) : null}
    </>
  );
}
const PACK_FILTERS: { id: PackFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "consumable", label: "耗材" },
  { id: "material", label: "材料" },
  { id: "equipment", label: "裝備" },
  { id: "rare", label: "稀有" },
];
const PACK_SORTS: { id: PackSort; label: string }[] = [
  { id: "stored", label: "收納順序" },
  { id: "name", label: "名稱" },
  { id: "quantity", label: "數量" },
];
function InventoryPanel() {
  const slots = useStore(inventory.store, (s) => s.slots);
  const rpg = useRpg(
    useShallow((s) => ({
      equipped: s.equipped,
      loadout: s.loadout,
      pockets: s.pockets,
      hp: s.hp,
      focus: s.focus,
      xp: s.xp,
    })),
  );
  const pose = useGame(
    useShallow((s) => ({ x: s.playerX, z: s.playerZ, yaw: s.playerYaw })),
  );
  const [filter, setFilter] = useState<PackFilter>("all");
  const [sort, setSort] = useState<PackSort>("stored");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const rows = packView(slots, {
    filter,
    sort,
    hp: rpg.hp,
    maxHp: maxHp(rpg),
    focus: rpg.focus,
    equipped: rpg.equipped,
    loadout: rpg.loadout,
  });
  const pickedItem = pickedId ? ITEMS.find((entry) => entry.id === pickedId) ?? null : null;
  const filterCategory =
    filter === "consumable" || filter === "material" || filter === "equipment" || filter === "rare"
      ? filter
      : null;
  const pickedVisible =
    pickedItem != null && (filterCategory === null || pickedItem.category === filterCategory);
  const pickedRow =
    pickedId == null
      ? null
      : (rows.find((row) => row.index === pickedIndex && row.itemId === pickedId) ??
        rows.find((row) => row.itemId === pickedId) ??
        null);
  const shown = pickedRow ?? (pickedVisible ? null : (rows[0] ?? null));
  const item = shown
    ? ITEMS.find((entry) => entry.id === shown.itemId) ?? null
    : pickedVisible
      ? pickedItem
      : null;
  const detail = item
    ? itemDetail({
        itemId: item.id,
        count: inventory.count(item.id),
        hp: rpg.hp,
        focus: rpg.focus,
        xp: rpg.xp,
        equipped: rpg.equipped,
      })
    : null;
  return (
    <>
      <div className="ad-section-line">
        <h3 className="ad-primary-label">隨身物品</h3>
        <span data-pose={`${pose.x},${pose.z},${pose.yaw}`}>
          {slots.length} / {slotCap(rpg.loadout, rpg.pockets, (id) => inventory.count(id) > 0)} 格
        </span>
      </div>
      <GearDock />
      <div className="ad-pack-tools">
        <div role="group" aria-label="背包篩選">
          {PACK_FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="ad-raise"
              aria-pressed={filter === entry.id}
              {...pressAttrs("button", filter === entry.id ? "selected" : "ready")}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <select
          aria-label="排序"
          value={sort}
          onChange={(event) => setSort(event.target.value as PackSort)}
        >
          {PACK_SORTS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      <div className="ad-pack-layout">
        {rows.length === 0 ? (
          <p className="ad-empty">
            {slots.length === 0 ? "背包是空的。" : "沒有符合的物品。"}
          </p>
        ) : (
          <div className="ad-slots">
            {rows.map((row) => (
              <button
                key={row.index}
                type="button"
                className={
                  "ad-slot ad-raise" + (row.index === shown?.index ? " selected" : "")
                }
                {...pressAttrs(
                  "button",
                  row.index === shown?.index ? "selected" : "ready",
                )}
                onClick={() => {
                  setPickedId(row.itemId);
                  setPickedIndex(row.index);
                }}
                aria-label={row.name + " " + row.quantity + " 個"}
              >
                <span>{row.icon}</span>
                <small>{row.name}</small>
                <b>{row.quantity}</b>
                <em>{row.state}</em>
              </button>
            ))}
          </div>
        )}
        {item && detail ? (
          <article
            className="ad-item-detail ad-raise-card"
            data-item={detail.itemId}
            data-count={detail.quantity}
            data-reason={detail.reason}
            data-life={`${detail.lifeUnequipped},${detail.lifeEquipped},${detail.lifeFrom},${detail.lifeTo}`}
            data-attack={`${detail.attackUnequipped},${detail.attackEquipped},${detail.attackFrom},${detail.attackTo}`}
            {...pressMark("card", "ready")}
          >
            <span className="ad-item-art">{item.icon}</span>
            <h3>{item.name}</h3>
            <dl className="ad-item-facts">
              <div>
                <dt>用途</dt>
                <dd>{detail.purpose}</dd>
              </div>
              <div>
                <dt>現有效果</dt>
                <dd>{detail.effect}</dd>
              </div>
              <div>
                <dt>數量</dt>
                <dd>{detail.quantity}</dd>
              </div>
              <div>
                <dt>來源</dt>
                <dd>{detail.source}</dd>
              </div>
              <div>
                <dt>堆疊</dt>
                <dd>{detail.stack}</dd>
              </div>
              <div>
                <dt>重量</dt>
                <dd>{detail.weight}</dd>
              </div>
              <div>
                <dt>取得線索</dt>
                <dd>{detail.clue}</dd>
              </div>
              <div>
                <dt>主要動作</dt>
                <dd>{detail.action}</dd>
              </div>
            </dl>
            {item.id === "badge" ? (
              <p className="ad-item-compare">
                生命上限 {detail.lifeFrom} → {detail.lifeTo}（{detail.lifeDelta > 0 ? "+" : ""}
                {detail.lifeDelta}）。普攻 {detail.attackFrom} → {detail.attackTo}（
                {detail.attackDelta > 0 ? "+" : ""}
                {detail.attackDelta}）。
              </p>
            ) : null}
            {item.category === "consumable" && (
              <button
                className="ad-primary ad-raise"
                {...pressAttrs("button", "ready")}
                onClick={() => useRpg.getState().useItem(item.id)}
              >
                使用物品
              </button>
            )}
            {item.id === "badge" && (
              <button
                className="ad-primary ad-raise"
                {...pressAttrs("button", "ready")}
                onClick={() => useRpg.getState().equip()}
              >
                {rpg.equipped ? "卸下徽章" : "裝備徽章"}
              </button>
            )}
            {item.category === "equipment" && item.id !== "badge" && (
              <button
                type="button"
                className="ad-primary ad-raise"
                onClick={() => useRpg.getState().equipItem(item.id)}
              >
                {factOf(item.id)?.slot && rpg.loadout[factOf(item.id)!.slot!] === item.id ? "卸下" : "裝備"}
              </button>
            )}
            {item.id === "repair-wrench" ? (
              <>
                <button type="button" className="ad-raise" onClick={() => useRpg.getState().repair()}>
                  修復附近設施
                </button>
                <button type="button" className="ad-raise" onClick={() => useRpg.getState().serviceWrench()}>
                  保養扳手
                </button>
              </>
            ) : null}
            {factOf(item.id)?.locked ? (
              <p>任務物品不能丟棄。遺失且不在地上時，可在委託完成後補領。</p>
            ) : item.category !== "equipment" ? null : (
              <button type="button" className="ad-raise" onClick={() => useRpg.getState().discardItem(item.id)}>
                丟棄
              </button>
            )}
          </article>
        ) : (
          <p className="ad-empty">選擇一格查看。</p>
        )}
      </div>
      <p className="ad-footnote">
        物品會自動堆疊。滿血／專注全滿時，補給品不會被消耗。
      </p>
    </>
  );
}
function SkillPanel() {
  const s = useRpg(
    useShallow((s) => ({
      departmentId: s.departmentId,
      xp: s.xp,
      skillRank: s.skillRank,
    })),
  );
  useStore(inventory.store, (s) => s.slots);
  const dept = DEPARTMENTS.find((d) => d.id === s.departmentId);
  if (!dept) return <DepartmentPanel />;
  const skill = DISCIPLINES[dept.discipline],
    level = levelForXp(s.xp),
    cost = { notes: s.skillRank * 5, credit: s.skillRank };
  return (
    <>
      <div className="ad-skill-hero" style={{ borderColor: skill.color }}>
        <GraduationCap size={34} />
        <span className="ad-eyebrow">
          {dept.college} / LEVEL {level}
        </span>
        <h3>{dept.name}</h3>
        <p>{skill.label}</p>
      </div>
      <div className="ad-skill-card ad-raise-card" {...pressMark("card", "ready")}>
        <span className="ad-key ad-raise-key" {...pressMark("key", "ready")}>Q</span>
        <div>
          <h3>
            {skill.skill} <small>階級 {s.skillRank} / 5</small>
          </h3>
          <p>{skill.description}</p>
          <div className="ad-tags">
            <span>傷害 {skill.damage + (s.skillRank - 1) * 12}</span>
            <span>範圍 {skill.range}m</span>
            <span>冷卻 {skill.cooldown} 秒</span>
            <span>專注 22</span>
          </div>
        </div>
      </div>
      <button
        className="ad-primary ad-raise"
        {...pressAttrs(
          "button",
          s.skillRank >= 5 || level < s.skillRank + 1 || !canPay(cost, inventory.count)
            ? "disabled"
            : "ready",
        )}
        disabled={
          s.skillRank >= 5 ||
          level < s.skillRank + 1 ||
          !canPay(cost, inventory.count)
        }
        onClick={() => useRpg.getState().upgrade()}
      >
        {s.skillRank >= 5
          ? "技能已達最高階"
          : "強化技能 · 筆記 " + cost.notes + " / 學分 " + cost.credit}
      </button>
      <p className="ad-footnote">
        升階需要角色等級至少達到下一個技能階級。探索、擊退異象與完成委託都能獲得經驗。
      </p>
      <div className="ad-tags">
        <span>J · 普攻</span>
        <span>空白鍵 · 閃避</span>
        <span>1 · 咖啡</span>
        <span>2 · 烏龍茶</span>
      </div>
    </>
  );
}
function BuildPanel() {
  const buildings = useRpg((s) => s.buildings);
  const interiorId = useRpg((s) => s.interiorId);
  const departmentId = useRpg((s) => s.departmentId);
  useStore(inventory.store, (s) => s.slots);
  const view = buildCards({
    interiorId,
    departmentId,
    buildingCount: buildings.length,
    count: (id) => inventory.count(id),
  });
  return (
    <>
      <p className="ad-lead">
        這些是遊戲裡的臨時設施，放在指定空地，不代表真實校園允許施工。選擇後可預覽、旋轉，取消不會扣材料。
      </p>
      <div className="ad-build-stock" aria-label="建造資源">
        {view.resources.map((item) => (
          <span key={item.id}>
            {item.name} {item.held}
          </span>
        ))}
      </div>
      <div className="ad-recipes">
        {view.cards.map((card) => (
          <article key={card.id}>
            <span
              className="ad-recipe-mark"
              style={{ background: RECIPES.find((recipe) => recipe.id === card.id)?.color }}
            >
              <Hammer size={25} />
            </span>
            <div>
              <h3>{card.name}</h3>
              <dl className="ad-recipe-facts">
                <div>
                  <dt>用途</dt>
                  <dd>{card.purpose}</dd>
                </div>
                <div>
                  <dt>大小</dt>
                  <dd>{card.size}</dd>
                </div>
                <div>
                  <dt>耐久</dt>
                  <dd>{card.durability}</dd>
                </div>
                <div>
                  <dt>材料</dt>
                  <dd className="ad-recipe-materials">
                    {card.materials.map((material) => (
                      <span
                        key={material.id}
                        className={material.short > 0 ? "missing" : undefined}
                      >
                        {material.name} {material.held}/{material.cost}
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>目前缺額</dt>
                  <dd>{card.shortageText}</dd>
                </div>
              </dl>
              <div className="ad-recipe-hint">{card.status}</div>
            </div>
            <button
              className="ad-primary ad-raise"
              {...pressAttrs("button", card.canPlace ? "ready" : "disabled")}
              disabled={!card.canPlace}
              onClick={() => useRpg.getState().chooseBuild(card.id)}
            >
              放置
            </button>
          </article>
        ))}
      </div>
      <div className="ad-section-line">
        <h3>已建設施</h3>
        <span>
          {view.count} / {view.cap}
        </span>
      </div>
      {buildings.length === 0 ? (
        <p className="ad-empty">第一座基地，從一張自習工作臺開始。</p>
      ) : (
        <div className="ad-built-list">
          {buildings.map((b) => (
            <div key={b.id}>
              <span>
                {RECIPES.find((r) => r.id === b.kind)?.name}{" "}
                <small>耐久 {Math.ceil(b.hp)}</small>
              </span>
              <button type="button" onClick={() => useRpg.getState().beginMove(b.id)}>
                移動
              </button>
              <button type="button" onClick={() => useRpg.getState().demolish(b.id)}>
                拆除 · 回收一半
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="ad-footnote">
        E 放置 · R 旋轉 · Esc 結束。移動不扣材料，取消會放回原處。拆除退回每種材料的一半，不足 1 的不退。校門、主路、入口、任務點與救援點不能堵。
      </p>
    </>
  );
}
function JournalPanel() {
  const s = useRpg(
    useShallow((s) => ({
      kills: s.kills,
      built: s.built,
      boss: s.boss,
      discoveries: s.discoveries,
      claimed: s.claimed,
      gathered: s.gathered,
      felled: s.felled,
    })),
  );
  return (
    <>
      <p className="ad-lead">還沒做完的會留在這裡。筆記是你帶走的記憶，喝的是提神，報告是另一種負荷。</p>
      <div className="ad-missions">
        {MISSIONS.map((m) => {
          const progress = missionProgress(m, s),
            done = s.claimed.includes(m.id);
          return (
            <article key={m.id}>
              <span className={"ad-mission-check " + (done ? "done" : "")}>
                {done ? "✓" : "◇"}
              </span>
              <div>
                <h3>{m.name}</h3>
                <p>{m.description}</p>
                <div className="ad-progress">
                  <i
                    style={{
                      width: Math.min(100, (progress / m.target) * 100) + "%",
                    }}
                  />
                </div>
                <small>
                  {Math.min(progress, m.target)} / {m.target} · 獎勵 {m.xp} 經驗
                </small>
              </div>
              <button
                className="ad-primary ad-raise"
                {...pressAttrs("button", done || progress < m.target ? "disabled" : "ready")}
                disabled={done || progress < m.target}
                onClick={() => useRpg.getState().claim(m.id)}
              >
                {done ? "已領取" : "領取獎勵"}
              </button>
            </article>
          );
        })}
      </div>
      <div className="ad-lore">
        <h3>異象觀察紀錄</h3>
        {Object.entries(ENEMY_TYPES).map(([id, e]) => (
          <p key={id}>
            <strong style={{ color: e.color }}>{e.name}</strong>　{e.hp} 生命 ·{" "}
            {e.damage} 傷害
            <br />
            <small>紅色圓環代表攻擊預警；離開範圍或閃避，能避開命中。</small>
          </p>
        ))}
        <p>
          <strong>截止日／停電異象</strong>
          <br />
          <small>
            每五分鐘的最後一分鐘，校園會出現環境異象。宮燈能減緩敵人，自習工作臺可協助恢復。
          </small>
        </p>
      </div>
    </>
  );
}
function MapGraphic({ compact = false }: { compact?: boolean }) {
  const press = useRef<{ id: string; x: number; y: number } | null>(null);
  const { x, z, yaw } = useGame(
    useShallow((s) => ({ x: s.playerX, z: s.playerZ, yaw: s.playerYaw })),
  );
  const discoveries = useRpg((s) => s.discoveries);
  const lesson = useRpg((s) => s.lesson);
  const lessonAnchor = useRpg((s) => s.lessonAnchor);
  const marker = lessonReadout().marker;
  const here = zoneNear(x, z);
  const scaleX = 480 / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX),
    scaleZ = 650 / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
  const px = (v: number) => (v - WORLD_BOUNDS.minX) * scaleX,
    pz = (v: number) => (v - WORLD_BOUNDS.minZ) * scaleZ;
  return (
    <svg
      viewBox="0 0 480 650"
      className={compact ? "ad-minimap-svg" : "ad-map-svg"}
      aria-label="淡江校園探索地圖"
    >
      <rect width="480" height="650" fill="#214b4c" />
      <path d="M0 0 H20 Q60 200 25 350 T12 650 H0Z" fill="#548191" />
      {[
        ...CAMPUS_ROADS,
        [
          [0, 90],
          [0, -300],
        ] as [number, number][],
      ].map((road, i) => (
        <path
          key={i}
          d={road
            .map(([x, z], j) => (j ? "L" : "M") + px(x) + " " + pz(z))
            .join(" ")}
          fill="none"
          stroke="#a1b3a1"
          strokeWidth={compact ? 2 : 3}
          opacity=".5"
        />
      ))}
      {CAMPUS_SITES.map((s) => (
        <g
          key={s.id}
          onPointerDown={(e) => {
            press.current = { id: s.id, x: e.clientX, y: e.clientY };
          }}
          onClick={(e) => {
            if (compact) return;
            const start = press.current;
            const distance =
              start && start.id === s.id
                ? Math.hypot(e.clientX - start.x, e.clientY - start.y)
                : 0;
            if (mapDragDecision({ intent: "go", distance }).fastTravel)
              useRpg.getState().travel(s.id);
          }}
          role={compact ? undefined : "button"}
          tabIndex={compact ? undefined : 0}
          aria-label={"前往" + s.name}
          onKeyDown={(e) => {
            if (e.key === "Enter") useRpg.getState().travel(s.id);
          }}
          style={{ cursor: compact ? "default" : "pointer" }}
        >
          <rect
            x={px(s.x - s.w / 2)}
            y={pz(s.z - s.d / 2)}
            width={s.w * scaleX}
            height={s.d * scaleZ}
            rx="2"
            fill={discoveries.includes(s.id) ? "#e8cc92" : "#8baba0"}
            stroke={zoneMark(s.id)?.color ?? "#d5e2dc"}
            strokeWidth={compact ? 4 : 3}
          />
          {!compact && (
            <text
              x={px(s.x)}
              y={pz(s.z) + 3}
              textAnchor="middle"
              fill="#173a3e"
              fontSize="8"
              fontWeight="700"
            >
              {s.code}
            </text>
          )}
        </g>
      ))}
      {LANDMARKS.map((l) => (
        <circle
          key={l.id}
          cx={px(l.x)}
          cy={pz(l.z)}
          r={compact ? 3 : 4}
          fill="#c7775d"
        />
      ))}
      {marker ? (
        <g key={`${lesson}:${lessonAnchor?.x ?? ""}:${lessonAnchor?.z ?? ""}`}>
          <circle
            cx={px(marker.x)}
            cy={pz(marker.z)}
            r={compact ? 7 : 10}
            fill="none"
            stroke="#ddaf61"
            strokeWidth={compact ? 2 : 3}
          />
          {!compact && (
            <text
              x={px(marker.x)}
              y={pz(marker.z) - 16}
              textAnchor="middle"
              fill="#f4e2b8"
              fontSize="16"
              fontWeight="700"
            >
              {lessonMapLabel(lesson)}
            </text>
          )}
        </g>
      ) : null}
      <g
        transform={
          "translate(" +
          px(x) +
          "," +
          pz(z) +
          ") rotate(" +
          (yaw * 180) / Math.PI +
          ")"
        }
      >
        <circle r={compact ? 12 : 10} fill="#f4dca4" opacity=".25" />
        <path d="M0 -9 L6 7 L0 3 L-6 7Z" fill="#fff1cf" />
      </g>
      {!compact && (
        <text x="450" y="28" fill="#e1e6d5" fontSize="13">
          N ↑
        </text>
      )}
      {!compact &&
        ZONE_MARK_ORDER.map((id, index) => (
          <g key={id} transform={"translate(18," + (48 + index * 22) + ")"}>
            <rect width="14" height="14" rx="2" fill={ZONE_MARK[id].color} />
            <text x="20" y="12" fill="#e1e6d5" fontSize="13">
              {ZONE_MARK[id].label}
            </text>
          </g>
        ))}
      {compact && here && (
        <text x="12" y="28" fill="#fff1cf" fontSize="28" fontWeight="700">
          {ZONE_MARK[here].label}
        </text>
      )}
    </svg>
  );
}
function MapPanel() {
  const [search, setSearch] = useState("");
  const discoveries = useRpg((s) => s.discoveries);
  const press = useRef<{ id: string; x: number; y: number } | null>(null);
  return (
    <>
      <div className="ad-map-layout">
        <MapGraphic />
        <div>
          <div className="ad-section-line">
            <h3 className="ad-primary-label">校園建築</h3>
            <span>
              {discoveries.length}/{CAMPUS_SITES.length}
            </span>
          </div>
          <input
            aria-label="搜尋校園建築"
            placeholder="搜尋校園建築…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ad-map-list">
            {CAMPUS_SITES.filter(
              (s) =>
                s.name.includes(search) ||
                s.venues?.some((v) => v.includes(search)) ||
                s.code.toLowerCase().includes(search.toLowerCase()),
            ).map((s) => (
              <button
                key={s.id}
                onPointerDown={(e) => {
                  press.current = { id: s.id, x: e.clientX, y: e.clientY };
                }}
                onClick={(e) => {
                  const start = press.current;
                  const distance =
                    start && start.id === s.id
                      ? Math.hypot(e.clientX - start.x, e.clientY - start.y)
                      : 0;
                  if (mapDragDecision({ intent: "go", distance }).fastTravel)
                    useRpg.getState().travel(s.id);
                }}
              >
                <b>{s.code}</b>
                <span>
                  {s.name}
                  <small>
                    {s.form === "court" ? "戶外場地" : s.floors + " 層"} ·{" "}
                    {discoveries.includes(s.id) ? "已發現" : "等待探索"}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="ad-footnote">
        點擊建築可快速前往入口，靠近後按 E
        進入。校園配置與室內採遊戲化重建，新增建物位置尚未實測。
      </p>
    </>
  );
}
function SettingsPanel() {
  const perf = usePerformance();
  useGame(
    useShallow((s) => ({
      timeOfDay: s.timeOfDay,
      graphics: s.graphics,
      muted: s.muted,
      phase: s.phase,
    })),
  );
  useRpg((s) => s.saved);
  const file = useRef<HTMLInputElement>(null);
  const surface = settingsSurface();
  return (
    <>
      {surface.sections.map((section) => (
        <section
          key={section.label}
          className="ad-settings-section"
          aria-label={section.label}
        >
          <h3 className="ad-primary-label">{section.label}</h3>
          {section.status ? (
            <p className="ad-settings-status">{section.status}</p>
          ) : null}
          {section.note ? (
            <p className="ad-settings-note">{section.note}</p>
          ) : null}
          {section.choices.length > 0 ? (
            <div className="ad-settings-options">
              {section.choices.map((choice) =>
                choice.action === "import" ? (
                  <button
                    key="import"
                    type="button"
                    className="ad-raise"
                    {...pressAttrs("button", "ready", "import")}
                    aria-pressed={false}
                    data-default="false"
                    onClick={() => file.current?.click()}
                  >
                    <Upload size={16} />
                    匯入存檔
                  </button>
                ) : (
                  <button
                    key={choice.action + ":" + choice.id}
                    type="button"
                    className={"ad-raise" + (choice.selected ? " selected" : "")}
                    {...pressAttrs(
                      "button",
                      choice.selected ? "selected" : "ready",
                    )}
                    aria-pressed={choice.selected}
                    data-default={choice.isDefault ? "true" : "false"}
                    onClick={() => applySettings(choice.action, choice.id)}
                  >
                    {choice.action === "export" ? <Download size={16} /> : null}
                    {choice.label}
                    {choice.isDefault ? (
                      <span className="ad-default-mark">預設</span>
                    ) : null}
                  </button>
                ),
              )}
            </div>
          ) : null}
          {section.label === "畫質" ? (
            <p className="ad-footnote" data-testid="performance">
              {perf.fps
                ? `目前 ${perf.fps} FPS · 解析度 ${perf.dpr}× · ${perf.drawCalls} 次繪製`
                : "遊玩片刻後將顯示效能資訊"}
            </p>
          ) : null}
        </section>
      ))}
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const input = e.target;
          const f = input.files?.[0];
          input.value = "";
          if (!f) return;
          if (f.size > 1_000_000) {
            useRpg.getState().notify("存檔檔案過大。");
            return;
          }
          const text = await f.text();
          if (stageImport(text) === "direct") importChosenSave(text);
        }}
      />
      <button
        type="button"
        className="ad-primary ad-raise"
        {...pressAttrs("button", "ready")}
        onClick={() => applySettings("return")}
      >
        {settingsReturnLabel(useGame.getState().phase)}
        <Play size={17} />
      </button>
    </>
  );
}
const STATUS_CUE_MARK: Record<StatusCueId, { text: string; Icon: typeof Heart }> = {
  hurt: { text: "受傷", Icon: HeartCrack },
  low: { text: "低生命", Icon: HeartPulse },
  recovery: { text: "恢復", Icon: Heart },
  level: { text: "升級", Icon: ArrowUp },
  "save-error": { text: "保存失敗，請匯出備份", Icon: CircleAlert },
};
function StatusCueMark({ id }: { id: StatusCueId }) {
  const cue = STATUS_CUE_MARK[id];
  const Icon = cue.Icon;
  return (
    <span className="ad-cue">
      <Icon aria-hidden="true" size={14} />
      <span>{cue.text}</span>
    </span>
  );
}
function StatusName() {
  const departmentId = useRpg((s) => s.departmentId);
  const dept = DEPARTMENTS.find((d) => d.id === departmentId);
  return <strong className="ad-primary-label">{dept?.name ?? "五虎崗旅人"}</strong>;
}
function SaveLine() {
  const saved = useRpg((s) => s.saved);
  return (
    <small>
      {saved === "error" ? (
        <StatusCueMark id="save-error" />
      ) : saved === "pending" ? (
        "正在保存…"
      ) : (
        "進度已保存"
      )}
    </small>
  );
}
function LifeMeter() {
  const snap = useRpg(
    useShallow((s) => ({
      hp: s.hp,
      xp: s.xp,
      equipped: s.equipped,
      hurt: s.hurtUntil > s.clock,
    })),
  );
  const read = useRef(holdLife()).current;
  const bar = read(snap);
  return (
    <div className="ad-readout">
      <div
        className="ad-meter hp"
        role="meter"
        aria-valuemin={0}
        aria-valuenow={bar.current}
        aria-valuemax={bar.max}
        aria-label={bar.line}
      >
        <i style={{ width: bar.fraction * 100 + "%" }} />
        <span>{bar.short}</span>
      </div>
      {bar.cues.map((cue) => (
        <StatusCueMark key={cue.id} id={cue.id} />
      ))}
    </div>
  );
}
function FocusMeter() {
  const focus = useRpg((s) => s.focus);
  const read = useRef(holdFocus()).current;
  const bar = read({ focus });
  return (
    <div className="ad-readout">
      <div
        className="ad-meter focus"
        role="meter"
        aria-valuemin={0}
        aria-valuenow={bar.current}
        aria-valuemax={bar.max}
        aria-label={bar.line}
      >
        <i style={{ width: bar.fraction * 100 + "%" }} />
        <span>{bar.short}</span>
      </div>
      {bar.cues.map((cue) => (
        <StatusCueMark key={cue.id} id={cue.id} />
      ))}
    </div>
  );
}
function ProgressMeter() {
  const xp = useRpg((s) => s.xp);
  const read = useRef(holdProgress()).current;
  const bar = read({ xp });
  return (
    <>
      <span className="ad-level">{bar.level}</span>
      <div className="ad-readout">
        <div
          className="ad-xp"
          role="meter"
          aria-valuemin={0}
          aria-valuenow={bar.current}
          aria-valuemax={bar.max}
          aria-label={bar.line}
        >
          <i style={{ width: bar.fraction * 100 + "%" }} />
          <span>{bar.short}</span>
        </div>
        {bar.cues.map((cue) => (
          <StatusCueMark key={cue.id} id={cue.id} />
        ))}
      </div>
    </>
  );
}
function CompactStatusCard() {
  const snap = useRpg(
    useShallow((s) => ({
      hp: s.hp,
      xp: s.xp,
      equipped: s.equipped,
      focus: s.focus,
      saved: s.saved,
    })),
  );
  const box = useViewportBox();
  const claimed = useRpg((s) => s.claimed);
  const term = semesterView(claimed);
  const text = compactStatus({
    life: snap.hp,
    lifeMax: maxHp(snap),
    focus: snap.focus,
    focusMax: 100,
    level: levelForXp(snap.xp),
    saved: snap.saved,
  });
  const rect = mobileHudLayout(box.width, box.height, box.insets).status;
  return (
    <div
      className="tk-mobile-status"
      style={place(rect)}
      data-semester={term.phase}
      aria-label={`${text.ariaLife} ${text.ariaFocus} ${text.ariaLevel} ${text.ariaSave} ${term.label}`}
    >
      <span>{text.visibleLife}</span>
      <span>{text.visibleFocus}</span>
      <span>{text.visibleLevel}</span>
      <span>{text.visibleSave}</span>
      <span className="tk-mobile-semester">{term.short}</span>
      <span className="tk-mobile-sr">
        {text.ariaLife} {text.ariaFocus} {text.ariaLevel} {text.ariaSave}
      </span>
    </div>
  );
}
function SemesterLine() {
  const claimed = useRpg((s) => s.claimed);
  const term = semesterView(claimed);
  return (
    <small className="ad-semester" data-semester={term.phase}>
      {term.label} · {term.next}
    </small>
  );
}
function Status() {
  return (
    <div className="ad-status ad-raise-card" {...pressMark("card", "ready")}>
      <div className="ad-depth ad-sheen" aria-hidden="true" />
      <div className="ad-status-title">
        <StatusName />
        <SaveLine />
        <SemesterLine />
      </div>
      <LifeMeter />
      <FocusMeter />
      <ProgressMeter />
    </div>
  );
}
function quickBackground(run: () => void) {
  if (useRpg.getState().panel) return;
  const tag = document.activeElement?.tagName ?? "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  run();
}
function QuickSlot({
  label,
  keyMark,
  slot,
  icon,
  press,
  keyPress,
  disabled,
  title,
  placed,
  onFire,
}: {
  label: string;
  keyMark: string;
  slot: QuickSlotView;
  icon: ReactNode;
  press: ReturnType<typeof pressAttrs>;
  keyPress: ReturnType<typeof pressMark>;
  disabled?: boolean;
  title?: string;
  placed?: CSSProperties;
  onFire: () => void;
}) {
  return (
    <button
      type="button"
      className="ad-raise"
      title={title}
      style={placed}
      aria-label={slot.state ? label + " " + slot.state : label}
      data-quick-state={slot.mark}
      data-in-use={slot.inUse ? "true" : "false"}
      data-seconds={slot.seconds}
      data-progress={slot.progress}
      {...press}
      {...(disabled !== undefined ? { disabled } : {})}
      onClick={onFire}
    >
      <span className="ad-key ad-raise-key" {...keyPress}>{keyMark}</span>
      <span className="ad-quick-icon" aria-hidden="true">
        {icon}
        <i className="ad-quick-meter" style={{ height: slot.progress * 100 + "%" }} />
      </span>
      <small>{label}</small>
      {slot.count !== null ? <span className="ad-quick-count">{slot.count}</span> : null}
      <b className="ad-quick-seconds">{slot.secondsText}</b>
      <em className="ad-quick-state">{slot.state}</em>
      {slot.inUse ? <span className="ad-quick-live" aria-hidden="true" /> : null}
    </button>
  );
}
function useViewportBox() {
  const [box, setBox] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    insets: readSafeInsets(),
  }));
  useEffect(() => {
    const update = () =>
      setBox({
        width: window.innerWidth,
        height: window.innerHeight,
        insets: readSafeInsets(),
      });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return box;
}
function placedSlot(bar: CssRect, slot: CssRect): CSSProperties {
  return {
    position: "absolute",
    left: slot.x - bar.x,
    top: slot.y - bar.y,
    width: slot.w,
    height: slot.h,
    minHeight: slot.h,
    right: "auto",
    bottom: "auto",
  };
}
const SKILL_ICONS: Record<(typeof SKILL_GLYPH)[Discipline], LucideIcon> = {
  DraftingCompass,
  FlaskConical,
  ScrollText,
  Coins,
  Languages,
  GraduationCap,
  Globe,
  Cpu,
  HeartPulse,
};

function SkillGlyph({ discipline }: { discipline: Discipline | null }) {
  const name = discipline ? SKILL_GLYPH[discipline] : null;
  const Icon = name ? SKILL_ICONS[name] : Sparkles;
  return <Icon size={21} aria-hidden="true" />;
}

function Quickbar({ coarse }: { coarse: boolean }) {
  const viewBox = useViewportBox();
  const placed: QuickbarPlacement | null = coarse
    ? quickbarPlace(viewBox.width, viewBox.height, viewBox.insets)
    : null;
  const rpg = useRpg(
    useShallow((s) => ({
      hp: s.hp,
      focus: s.focus,
      xp: s.xp,
      equipped: s.equipped,
      departmentId: s.departmentId,
      panel: s.panel,
      interiorId: s.interiorId,
      buildKind: s.buildKind,
      clock: s.clock,
      skillUntil: s.skillUntil,
      dodgeUntil: s.dodgeUntil,
      attackUntil: s.attackUntil,
    })),
  );
  const game = useGame(useShallow((s) => ({ phase: s.phase, plaqueId: s.plaqueId })));
  const slots = useStore(inventory.store, (s) => s.slots);
  void slots;
  const view = quickbarReadout({
    phase: game.phase,
    plaqueId: game.plaqueId,
    panel: rpg.panel,
    hp: rpg.hp,
    focus: rpg.focus,
    xp: rpg.xp,
    equipped: rpg.equipped,
    departmentId: rpg.departmentId,
    buildKind: rpg.buildKind,
    interiorId: rpg.interiorId,
    clock: rpg.clock,
    skillUntil: rpg.skillUntil,
    dodgeUntil: rpg.dodgeUntil,
    attackUntil: rpg.attackUntil,
    coffee: inventory.count("coffee"),
    tea: inventory.count("tea"),
  });
  const s = { cooldown: Math.max(0, Math.ceil(view.skill.seconds)) };
  const dept = DEPARTMENTS.find((d) => d.id === rpg.departmentId),
    skill = dept ? DISCIPLINES[dept.discipline] : null;
  const at = (index: number) => (placed ? placedSlot(placed.bar, placed.slots[index]) : undefined);
  return (
    <div
      className={placed ? "ad-quickbar ad-quickbar-placed" : "ad-quickbar"}
      style={
        placed
          ? {
              position: "absolute",
              left: placed.bar.x,
              top: placed.bar.y,
              width: placed.bar.w,
              height: placed.bar.h,
              right: "auto",
              bottom: "auto",
              transform: "none",
            }
          : undefined
      }
    >
      <QuickSlot
        label="普攻"
        keyMark="J"
        slot={view.attack}
        icon={<Shield size={21} />}
        press={pressAttrs("button", "ready")}
        keyPress={pressMark("key", "ready")}
        placed={at(0)}
        onFire={() => quickBackground(() => useRpg.getState().attack())}
      />
      <QuickSlot
        label="技能"
        keyMark="Q"
        slot={view.skill}
        icon={<SkillGlyph discipline={dept?.discipline ?? null} />}
        press={pressAttrs("button", s.cooldown > 0 ? "waiting" : "ready")}
        keyPress={pressMark("key", s.cooldown > 0 ? "waiting" : "ready")}
        disabled={s.cooldown > 0}
        title={skill?.skill}
        placed={at(1)}
        onFire={() => quickBackground(() => useRpg.getState().attack(true))}
      />
      <QuickSlot
        label="閃避"
        keyMark="Space"
        slot={view.dodge}
        icon={<Compass size={21} />}
        press={pressAttrs("button", view.dodge.seconds > 0 ? "waiting" : "ready")}
        keyPress={pressMark("key", view.dodge.seconds > 0 ? "waiting" : "ready")}
        placed={at(2)}
        onFire={() => quickBackground(() => input.tap("dodge"))}
      />
      {placed ? null : <span className="ad-quick-divider" />}
      <QuickSlot
        label="咖啡"
        keyMark="1"
        slot={view.coffee}
        icon={<span className="ad-consumable">☕</span>}
        press={pressAttrs("button", inventory.has("coffee") ? "ready" : "disabled")}
        keyPress={pressMark("key", inventory.has("coffee") ? "ready" : "disabled")}
        disabled={!inventory.has("coffee")}
        placed={at(3)}
        onFire={() => quickBackground(() => useRpg.getState().useItem("coffee"))}
      />
      <QuickSlot
        label="茶"
        keyMark="2"
        slot={view.tea}
        icon={<span className="ad-consumable">♧</span>}
        press={pressAttrs("button", inventory.has("tea") ? "ready" : "disabled")}
        keyPress={pressMark("key", inventory.has("tea") ? "ready" : "disabled")}
        disabled={!inventory.has("tea")}
        placed={at(4)}
        onFire={() => quickBackground(() => useRpg.getState().useItem("tea"))}
      />
    </div>
  );
}
function readSafeInsets(): SafeInsets {
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof document === "undefined") return zero;
  const style = getComputedStyle(document.documentElement);
  const px = (name: string) => {
    const n = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: px("--sat"),
    right: px("--sar"),
    bottom: px("--sab"),
    left: px("--sal"),
  };
}

function measureTouchLayout() {
  return touchLayout(window.innerWidth, window.innerHeight, readSafeInsets());
}

function useTouchLayout() {
  const [layout, setLayout] = useState<TouchLayout>(() => measureTouchLayout());
  useEffect(() => {
    const update = () => setLayout(measureTouchLayout());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return layout;
}

function place(rect: CssRect): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.w, height: rect.h };
}

function usePromptChoice() {
  const pose = useGame(
    useShallow((s) => ({
      phase: s.phase,
      plaqueId: s.plaqueId,
      x: s.playerX,
      z: s.playerZ,
      yaw: s.playerYaw,
      visited: s.visited,
    })),
  );
  const live = useRpg(
    useShallow((s) => ({
      hp: s.hp,
      panel: s.panel,
      interiorId: s.interiorId,
      buildKind: s.buildKind,
      rotation: s.rotation,
      buildings: s.buildings,
      loot: s.loot,
      harvested: s.harvested,
    })),
  );
  const slots = useStore(inventory.store, (s) => s.slots);
  void pose;
  void live;
  void slots;
  return promptDecision(promptSnap());
}
function TouchControls({ look = true, mobile = false }: { look?: boolean; mobile?: boolean } = {}) {
  const measured = useTouchLayout();
  const box = useViewportBox();
  const hud = mobile ? mobileHudLayout(box.width, box.height, box.insets) : null;
  const layout = hud
    ? {
        ...measured,
        stick: hud.stick,
        look: hud.look,
        sprint: hud.sprint,
        dodge: hud.dodge,
        interact: hud.interact,
      }
    : measured;
  const prompt = usePromptChoice();
  const knob = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const release = () => input.releaseTouch();
    const onHide = () => {
      if (document.hidden) input.releaseTouch();
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onHide);
      input.releaseTouch();
    };
  }, []);
  const finish = (e: ReactPointerEvent, kind: PointerEndKind) => {
    const zone = input.pointerEnd(e.pointerId, kind);
    if (zone === "stick" && input.joyX === 0 && input.joyY === 0 && knob.current)
      knob.current.style.transform = "translate(0px,0px)";
  };
  const bind = (zone: TouchZone) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      input.pointerDown(e.pointerId, zone, e.clientX, e.clientY);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const knobPos = input.pointerMove(e.pointerId, e.clientX, e.clientY);
      if (knobPos && knob.current)
        knob.current.style.transform = `translate(${knobPos.x}px,${knobPos.y}px)`;
    },
    onPointerUp: (e: ReactPointerEvent) => finish(e, "up"),
    onPointerCancel: (e: ReactPointerEvent) => finish(e, "cancel"),
    onLostPointerCapture: (e: ReactPointerEvent) => finish(e, "lost"),
  });
  return (
    <>
      {look ? (
        <div className={mobile ? "ad-look tk-mobile-look" : "ad-look"} style={place(layout.look)} aria-label={CHROME_CONTROLS.look} {...bind("look")} />
      ) : null}
      <div className="ad-stick" style={place(layout.stick)} aria-label={CHROME_CONTROLS.stick} {...bind("stick")}>
        <div ref={knob} />
      </div>
      <button type="button" className="ad-touch-run ad-raise" style={place(layout.sprint)} {...pressAttrs("button", "ready")} {...bind("sprint")}>
        {CHROME_CONTROLS.run}
      </button>
      <button type="button" className="ad-touch-dodge ad-raise" style={place(layout.dodge)} {...pressAttrs("button", "ready")} {...bind("dodge")}>
        {CHROME_CONTROLS.dodge}
      </button>
      <button type="button" className="ad-touch-e ad-raise" style={place(layout.interact)} aria-label={prompt ? prompt.text : "互動"} {...pressAttrs("button", "ready")} {...bind("interact")}>
        {prompt ? prompt.marker : "互動"}
      </button>
    </>
  );
}
function Nearby({ coarse }: { coarse: boolean }) {
  const box = useViewportBox();
  const mobile = coarse && isMobileViewport(box.width, box.height);
  const choice = usePromptChoice();
  if (!choice) return null;
  return (
    <div className="ad-interact ad-raise-overlay" {...pressMark("overlay", "ready")}>
      {choice.kind === "place" ? <Hammer size={18} /> : <BookOpen size={18} />}
      {!coarse && (
        <span className="ad-key ad-raise-key" {...pressMark("key", "ready")}>E</span>
      )}
      <span>{choice.text}</span>
      {choice.kind === "place" ? (
        <>
          <button
            type="button"
            className="ad-raise"
            style={mobile ? { minWidth: 44, minHeight: 44 } : undefined}
            {...pressAttrs("button", "ready")}
            onClick={() => useRpg.getState().commitPrompt()}
          >
            放置
          </button>
          <button
            type="button"
            className="ad-raise"
            style={mobile ? { minWidth: 44, minHeight: 44 } : undefined}
            {...pressAttrs("button", "ready")}
            onClick={() => useRpg.getState().rotate()}
          >
            旋轉
          </button>
          <button
            type="button"
            className="ad-raise"
            style={mobile ? { minWidth: 44, minHeight: 44 } : undefined}
            {...pressAttrs("button", "ready")}
            onClick={() => useRpg.getState().cancelBuild()}
          >
            結束建造
          </button>
        </>
      ) : (
        <button
          type="button"
          className="ad-raise"
          {...pressAttrs("button", "ready")}
          onClick={() => input.tap("interact")}
        >
          {choice.text}
        </button>
      )}
    </div>
  );
}
function LessonLayer({
  phase,
  panel,
  coarse,
}: {
  phase: string;
  panel: RpgPanel | null;
  coarse: boolean;
}) {
  const playerX = useGame((s) => s.playerX);
  const playerZ = useGame((s) => s.playerZ);
  const lesson = useRpg((s) => s.lesson);
  const anchor = useRpg((s) => s.lessonAnchor);
  const incomingSave = useRpg((s) => s.incomingSave);
  const readout = lessonReadout();
  useEffect(() => {
    if (phase !== "playing") return;
    observeSupply();
  }, [phase, playerX, playerZ, lesson]);
  const showCard =
    Boolean(readout.step) && (phase !== "title" || panel === "department");
  const showReview =
    !incomingSave &&
    readout.step === null &&
    lesson === "done" &&
    phase === "playing" &&
    !readout.review;
  const box = useViewportBox();
  const mobile = coarse && isMobileViewport(box.width, box.height);
  const lessonHud = mobile ? mobileHudLayout(box.width, box.height, box.insets) : null;
  const lessonStyle: CSSProperties | undefined = lessonHud
    ? {
        position: "absolute",
        left: lessonHud.look.x,
        top: lessonHud.look.y,
        width: lessonHud.look.w,
        maxWidth: lessonHud.look.w,
        transform: "none",
      }
    : undefined;
  return (
    <>
      {showCard && readout.objective ? (
        <div
          className="ad-lesson"
          role="status"
          data-lesson={readout.step ?? ""}
          data-anchor={`${anchor?.x ?? ""},${anchor?.z ?? ""}`}
          style={lessonStyle}
        >
          <strong>{readout.objective}</strong>
          {readout.prompt ? <em>{readout.prompt}</em> : null}
          <button
            type="button"
            className="ad-raise"
            {...pressAttrs("button", "ready")}
            onClick={() => skipLesson()}
          >
            略過
          </button>
        </div>
      ) : null}
      {showReview ? (
        <button
          type="button"
          className="ad-lesson-review ad-raise"
          {...pressAttrs("button", "ready")}
          onClick={() => openLessonReview()}
        >
          重看操作
        </button>
      ) : null}
      {readout.review && readout.reminder ? (
        <Dialog title="操作" onClose={() => closeLessonReview()}>
          <p className="ad-lead">{readout.reminder}</p>
          <button
            type="button"
            className="ad-raise"
            {...pressAttrs("button", "ready", "cancel")}
            onClick={() => closeLessonReview()}
          >
            取消
          </button>
        </Dialog>
      ) : null}
      {coarse && readout.step === "department" && panel === "department" ? (
        <div className="ad-lesson-reach">
          <Quickbar coarse={false} />
          <TouchControls look={false} />
        </div>
      ) : null}
    </>
  );
}
function MobileChrome({
  hud,
  panel,
  mapLesson,
}: {
  hud: MobileHudModel;
  panel: RpgPanel | null;
  mapLesson: string | null;
}) {
  const specs = [
    ...PANELS,
    ["settings", CHROME_CONTROLS.settings, Pause, ""] as const,
  ];
  const placed = new Set(hud.launchers.map((item) => item.id));
  const button = (id: (typeof specs)[number][0], label: string, Icon: (typeof specs)[number][2], rect?: CssRect) => (
    <button
      key={id}
      id={id === "settings" ? "tk-mobile-open-settings" : `tk-mobile-open-${id}`}
      className="ad-icon ad-raise-icon"
      title={label}
      aria-label={label}
      style={rect ? { position: "absolute", ...place(rect) } : undefined}
      {...pressAttrs("icon", panel === id ? "selected" : "ready")}
      onClick={() => {
        if (id === "settings") {
          openSettings();
          return;
        }
        useRpg.getState().setPanel(panel === id ? null : id);
      }}
    >
      <Icon size={19} />
    </button>
  );
  return (
    <>
      {hud.launchers.map((launcher) => {
        const spec = specs.find((item) => item[0] === launcher.id);
        if (!spec) return null;
        return button(spec[0], spec[1], spec[2], launcher.rect);
      })}
      {hud.tray ? (
        <div className="tk-mobile-tray tk-mobile-hit" style={{ position: "absolute", ...place(hud.tray) }}>
          {specs
            .filter((item) => !placed.has(item[0]))
            .sort((a, b) => Number(b[0] === "settings") - Number(a[0] === "settings"))
            .map((item) => button(item[0], item[1], item[2]))}
        </div>
      ) : null}
      <button
        className="ad-minimap"
        style={{ position: "absolute", ...place(hud.minimap), padding: 2 }}
        aria-label={mapLesson ? `${CHROME_CONTROLS.openMap}，${mapLesson}` : CHROME_CONTROLS.openMap}
        onClick={() => useRpg.getState().setPanel("map")}
      >
        <MapGraphic compact />
        {mapLesson ? <span className="ad-minimap-lesson">{mapLesson}</span> : null}
      </button>
    </>
  );
}
export function AdventureHud() {
  const phase = useGame((s) => s.phase),
    plaqueId = useGame((s) => s.plaqueId),
    muted = useGame((s) => s.muted),
    timeOfDay = useGame((s) => s.timeOfDay),
    graphicsTier = useGame((s) => s.graphics.tier);
  const state = useRpg(
    useShallow((s) => ({
      panel: s.panel,
      departmentId: s.departmentId,
      notice: s.notice,
      noticeAt: s.noticeAt,
      down: s.hp <= 0,
      interior: s.interiorId,
      floor: s.floor,
      anomaly: s.anomaly,
      buildKind: s.buildKind,
      saveConflict: s.saveConflict,
      incomingSave: s.incomingSave,
      lesson: s.lesson,
    })),
  );
  const viewBox = useViewportBox();
  const titleFile = useRef<HTMLInputElement>(null);
  const settingsOpen = useGame((s) => s.settingsOpen);
  const home = phase === "title" ? readHome() : null;
  const showSettings =
    settingsVisible() && (settingsOpen || phase === "paused");
  const [coarse, setCoarse] = useState(
      () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches,
    ),
    [toast, setToast] = useState(""),
    [reduced, setReduced] = useState(
      () =>
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const mobile = coarse && isMobileViewport(viewBox.width, viewBox.height);
  const mobileHud = mobile ? mobileHudLayout(viewBox.width, viewBox.height, viewBox.insets) : null;
  const mapLesson = lessonMapLabel(state.lesson);
  useEffect(() => {
    setCoarse(matchMedia("(pointer: coarse)").matches);
  }, []);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener?.("change", apply);
    return () => media.removeEventListener?.("change", apply);
  }, []);
  useEffect(() => {
    campusAudio.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    setToast(state.notice);
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [state.notice, state.noticeAt]);
  const plaque = plaqueId ? LANDMARK_BY_ID[plaqueId] : null,
    site = CAMPUS_SITES.find((s) => s.id === state.interior);
  const close = () => {
    const panel = useRpg.getState().panel;
    if (panel === "narrative") {
      useRpg.getState().narrativeDismiss();
      return;
    }
    if (panel === "variety") {
      dismissVariety();
      useRpg.getState().setPanel(null);
      return;
    }
    useRpg.getState().setPanel(null);
    if (!mobile || !panel) return;
    const restore = panelClosePlan(panel).restoreFocusId;
    requestAnimationFrame(() => {
      document.getElementById(restore)?.focus();
    });
  };
  const title =
    state.panel === "department"
      ? "選擇你的主修"
      : state.panel === "narrative"
        ? "校園裡的人"
        : state.panel === "variety"
          ? varietyHeading()
          : (PANELS.find((p) => p[0] === state.panel)?.[1] ?? "");
  const tier: ChromeTier =
    graphicsTier === "low" ? "low" : graphicsTier === "high" ? "high" : quality().tier;
  return (
    <div
      className={mobile ? "ad-ui tk-mobile" : "ad-ui"}
      data-quality={tier}
      data-chrome="scale"
      style={chromeVars({ time: timeOfDay, tier }, reduced) as CSSProperties}
    >
      {state.incomingSave && (
        <div className="ad-scrim">
          <section
            className="ad-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="替換存檔"
          >
            <div className="ad-depth ad-sheen" aria-hidden="true" />
            <header>
              <div>
                <span className="ad-eyebrow">TAMKANG / SAVE</span>
                <h2 className="ad-primary-label">替換存檔</h2>
              </div>
            </header>
            <div className="ad-dialog-body">
              <p className="ad-lead">
                匯入會取代目前的進度。請先匯出備份，再確認替換。
              </p>
              <div className="ad-settings-options">
                <button
                  type="button"
                  className="ad-raise"
                  {...pressAttrs("button", "ready")}
                  onClick={() => exportHomeBackup()}
                >
                  <Download size={16} />
                  匯出存檔
                </button>
                <button
                  type="button"
                  className="ad-raise"
                  {...pressAttrs("button", "ready")}
                  onClick={() => confirmImport()}
                >
                  確認匯入
                </button>
                <button
                  type="button"
                  className="ad-raise"
                  {...pressAttrs("button", "ready")}
                  onClick={() => cancelImport()}
                >
                  取消
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {state.saveConflict && !state.incomingSave && (
        <div className="ad-scrim">
          <section
            className="ad-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="另一分頁已更新存檔"
          >
            <div className="ad-depth ad-sheen" aria-hidden="true" />
            <header>
              <div>
                <span className="ad-eyebrow">TAMKANG / SAVE</span>
                <h2 className="ad-primary-label">另一分頁已寫入存檔</h2>
              </div>
            </header>
            <div className="ad-dialog-body">
              <p className="ad-lead">
                同一份存檔在另一個分頁更新了。保留這一頁的進度，或重新載入對方寫入的進度。
              </p>
              <div className="ad-settings-options">
                <button
                  type="button"
                  className="ad-raise"
                  {...pressAttrs("button", "ready", "confirm")}
                  onClick={() => useRpg.getState().keepProgress()}
                >
                  保留現有進度
                </button>
                <button
                  type="button"
                  className="ad-raise"
                  {...pressAttrs("button", "ready")}
                  onClick={() => useRpg.getState().reloadProgress()}
                >
                  重新載入
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {home && (
        <div className="ad-title">
          <div className="ad-depth ad-sheen" aria-hidden="true" />
          <div className="ad-title-top">
            <span className="ad-brand-mark">TKU</span>
            <span>
              淡江世界
              <br />
              <small>TAMKANG WORLD</small>
            </span>
            <span className="ad-title-edition">校園冒險 / 01</span>
          </div>
          <div className="ad-title-content">
            <div className="ad-eyebrow">
              <i /> A NEW SEMESTER ON WUHU HILL
            </div>
            <h1 className="ad-primary-label">
              五虎崗上，
              <br />
              展開你的<span>新學期。</span>
            </h1>
            <p>
              白天探索校園，夜裡迎向異象。
              <br />
              讓你的科系專長，成為這個世界的力量。
            </p>
            {home.kind === "progress" ? (
              <div className="ad-home-summary">
                <p>主修 {home.major}</p>
                <p>{home.progress}</p>
                <p>{home.summary}</p>
              </div>
            ) : null}
            {home.fileError ? <p className="ad-home-summary">{home.fileError}</p> : null}
            {home.storageLimit ? (
              <p className="ad-home-summary">{home.storageLimit}</p>
            ) : null}
            <div className="ad-title-actions">
              <button
                type="button"
                className="ad-primary ad-raise"
                {...pressAttrs("button", "ready")}
                onClick={() => {
                  campusAudio.unlock();
                  enterHome();
                }}
              >
                {home.primary}
                <ArrowUpRight size={20} />
              </button>
              <button
                type="button"
                className="ad-title-secondary ad-raise"
                {...pressAttrs("button", "ready", "import")}
                onClick={() => titleFile.current?.click()}
              >
                <Upload size={16} />
                {home.importLabel}
              </button>
              <button
                type="button"
                className="ad-title-secondary ad-raise"
                {...pressAttrs("button", "ready")}
                onClick={() => exportHomeBackup()}
              >
                <Download size={16} />
                {home.exportLabel}
              </button>
              <button
                type="button"
                className="ad-title-secondary ad-raise"
                {...pressAttrs("button", "ready")}
                onClick={() => openSettings()}
              >
                {CHROME_CONTROLS.settings}
                <Settings2 size={17} />
              </button>
            </div>
            <input
              ref={titleFile}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const input = e.target;
                const f = input.files?.[0];
                input.value = "";
                if (!f) return;
                if (f.size > 1_000_000) {
                  useRpg.getState().notify("存檔檔案過大。");
                  return;
                }
                const text = await f.text();
                if (stageImport(text) === "direct") importChosenSave(text);
              }}
            />
            <div className="ad-title-features">
              <span>科系技能</span>
              <span>自由建造</span>
              <span>校園探索</span>
              <span>異象戰鬥</span>
            </div>
          </div>
          <footer>
            <span>樸實剛毅 / 從克難坡出發</span>
            <span>非官方校園創作</span>
          </footer>
        </div>
      )}
      {phase !== "title" && (
        <>
          {mobile && <CompactStatusCard />}
          <VarietyDock />
          {mobile && mobileHud ? (
            <MobileChrome hud={mobileHud} panel={state.panel} mapLesson={mapLesson} />
          ) : null}
          {mobile ? null : (
          <header className="ad-hud-top">
            {mobile ? null : <Status />}
            <div className="ad-hud-right" style={mobile ? { marginLeft: "auto" } : undefined}>
              <nav>
                {PANELS.map(([id, label, Icon, key]) => (
                  <button
                    key={id}
                    id={mobile ? `tk-mobile-open-${id}` : undefined}
                    className="ad-icon ad-raise-icon"
                    title={label + " (" + key + ")"}
                    aria-label={label}
                    {...pressAttrs("icon", state.panel === id ? "selected" : "ready")}
                    onClick={() =>
                      useRpg.getState().setPanel(state.panel === id ? null : id)
                    }
                  >
                    <Icon size={19} />
                  </button>
                ))}
                <button
                  id={mobile ? "tk-mobile-open-settings" : undefined}
                  className="ad-icon ad-raise-icon"
                  aria-label={CHROME_CONTROLS.settings}
                  {...pressAttrs("icon", "ready")}
                  onClick={() => openSettings()}
                >
                  <Pause size={19} />
                </button>
              </nav>
              <button
                className="ad-minimap"
                aria-label={mapLesson ? `${CHROME_CONTROLS.openMap}，${mapLesson}` : CHROME_CONTROLS.openMap}
                onClick={() => useRpg.getState().setPanel("map")}
              >
                <MapGraphic compact />
                {mapLesson ? <span className="ad-minimap-lesson">{mapLesson}</span> : null}
              </button>
            </div>
          </header>
          )}
          <Nearby coarse={coarse} />
          {phase === "playing" && !state.panel && !state.down && (
            <>
              <Quickbar coarse={coarse} />
              {coarse && <TouchControls mobile={mobile} />}
            </>
          )}
          {site && (
            <div className="ad-interior-bar ad-raise-overlay" {...pressMark("overlay", "ready")}>
              <strong>
                {site.name} · {state.floor} 樓
              </strong>
              <button
                className="ad-raise-icon"
                aria-label={CHROME_CONTROLS.floorDown}
                {...pressAttrs("icon", state.floor <= 1 ? "disabled" : "ready")}
                onClick={() => useRpg.getState().changeFloor(-1)}
                disabled={state.floor <= 1}
              >
                <ChevronDown size={17} />
              </button>
              <button
                className="ad-raise-icon"
                aria-label={CHROME_CONTROLS.floorUp}
                {...pressAttrs("icon", state.floor >= site.floors ? "disabled" : "ready")}
                onClick={() => useRpg.getState().changeFloor(1)}
                disabled={state.floor >= site.floors}
              >
                <ChevronUp size={17} />
              </button>
              <button
                className="ad-raise"
                {...pressAttrs("button", "ready", "back")}
                onClick={() => useRpg.getState().exit()}
              >
                {CHROME_CONTROLS.exitCampus}
              </button>
            </div>
          )}
          {state.anomaly !== "quiet" && !site && (
            <div className="ad-anomaly ad-raise-overlay" {...pressMark("overlay", "ready")}>
              ◇{" "}
              {state.anomaly === "deadline"
                ? "截止日異象 · 敵人正在加速"
                : "停電異象 · 守住你的宮燈"}
            </div>
          )}
        </>
      )}
      {state.panel && !showSettings && !state.incomingSave && (
        <Dialog
          title={title}
          onClose={close}
          className={state.panel === "narrative" ? "ad-narrative-scrim" : undefined}
          closeId={
            state.panel === "narrative"
              ? "narrative-close"
              : mobile && state.panel && state.panel !== "variety"
                ? panelClosePlan(state.panel).closeId
                : undefined
          }
          scrollId={
            state.panel === "narrative"
              ? "narrative-scroll"
              : mobile && state.panel && state.panel !== "variety"
                ? panelClosePlan(state.panel).scrollId
                : undefined
          }
        >
          {state.panel === "narrative" ? (
            <NarrativePanel />
          ) : state.panel === "variety" ? (
            <VarietyPanel />
          ) : state.panel === "department" ? (
            <DepartmentPanel />
          ) : state.panel === "inventory" ? (
            <InventoryPanel />
          ) : state.panel === "skills" ? (
            <SkillPanel />
          ) : state.panel === "build" ? (
            <BuildPanel />
          ) : state.panel === "journal" ? (
            <JournalPanel />
          ) : (
            <MapPanel />
          )}
        </Dialog>
      )}
      {showSettings && !state.incomingSave && (
        <Dialog
          title={phase === "title" ? CHROME_CONTROLS.settings : "休息一下"}
          onClose={returnFromSettings}
        >
          <SettingsPanel />
        </Dialog>
      )}
      {plaque && !state.panel && !showSettings && !state.incomingSave && (
        <Dialog
          title={plaque.name}
          onClose={() => useGame.getState().openPlaque(null)}
        >
          <span className="ad-eyebrow">{plaque.nameEn}</span>
          <p className="ad-lead" data-sign-wording={signHost().wording}>
            {plaque.blurb}
          </p>
          <button
            className="ad-primary ad-raise"
            {...pressAttrs("button", "ready")}
            onClick={() => useGame.getState().openPlaque(null)}
          >
            {CHROME_CONTROLS.explore}
          </button>
        </Dialog>
      )}
      <LessonLayer phase={phase} panel={state.panel} coarse={coarse} />
      {state.down && (
        <div className="ad-scrim">
          <section className="ad-defeat">
            <div className="ad-depth ad-sheen" aria-hidden="true" />
            <span className="ad-eyebrow">TAKE A BREATH</span>
            <h2 className="ad-primary-label">這次，先休息一下。</h2>
            <p>學期還沒結束。你的背包、建築與探索進度都會保留。</p>
            <button
              className="ad-primary ad-raise"
              {...pressAttrs("button", "ready")}
              onClick={() => useRpg.getState().respawn()}
            >
              回到克難坡，重新出發
            </button>
          </section>
        </div>
      )}
      <AdventureCombatHud />
      {toast && (
        <div
          className={mobile ? "ad-toast ad-raise-overlay tk-mobile-notice" : "ad-toast ad-raise-overlay"}
          role="status"
          style={
            mobileHud
              ? mobileHud.notice.w >= 160
                ? {
                    position: "absolute",
                    left: mobileHud.notice.x,
                    top: mobileHud.notice.y,
                    width: mobileHud.notice.w,
                    height: "auto",
                    minHeight: 44,
                    maxHeight: 88,
                    transform: "none",
                    maxWidth: mobileHud.notice.w,
                  }
                : {
                    position: "absolute",
                    left: mobileHud.look.x,
                    top: mobileHud.look.y + Math.max(0, mobileHud.look.h - 72),
                    width: mobileHud.look.w,
                    height: "auto",
                    minHeight: 44,
                    maxHeight: 72,
                    transform: "none",
                    maxWidth: mobileHud.look.w,
                  }
              : undefined
          }
          {...pressMark("overlay", "ready")}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
