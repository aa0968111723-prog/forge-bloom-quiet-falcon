# 共同契約

整合代理維護對照。本輪只有美術線提交了新契約；後端與內容線尚未提供檔案。下面「現行」是 `main` @ `71f4d3c` 加上美術 M1 後，程式裡真正在用的介面。

## 誰提供什麼

| 契約 | 提供線 | 本輪版本 | 位置 |
| --- | --- | --- | --- |
| API | 後端 | 雲端信封 `schemaVersion` 1，已在 `main` | `docs/backend/API.md` |
| 內容 schema | 內容 | 敘事 manifest `revision` 1。沒有 `schemaVersion`。效果白名單在 `src/features/narrative/schema.ts` | `content/narrative/`、`docs/content/` |
| 資產 manifest | 美術 | `schemaVersion` 1 | `art/assets.json` → `public/game-art/manifest.json` |

## 資產

| id | 用途 | 載入 | 失敗時 |
| --- | --- | --- | --- |
| `char.student-kit` | 高畫質主角 | `Protagonist` | `ArtBoundary` 改回 `Student`，並通知一次 |
| `char.student-kit-lod1` | 省電主角。同骨架、同動畫 | 低畫質 | 同上 |
| `creature.quiz` | `kind === "quiz"` | `CreatureActor` | 改回 `LegacyMonster` |
| `creature.report` | `kind === "report"` | `CreatureActor` | 同上 |
| `creature.exam` | `kind === "exam"` | `CreatureActor` | 同上 |
| `creature.final` | `kind === "final"` | `CreatureActor` | 同上 |
| `char.npc-kit` | 五條既有路徑上的 NPC | `NpcCharacter` | 改回程序 `Student` |

URL 帶內容雜湊。幾何與 atlas 共享。卸載只走 `releaseArtInstance`：釋放複製材質與骨架 bone texture，不釋放共享幾何。

九學院技能都有專屬外形，讀既有 `attackFx`。工程「結構脈衝」仍是 `StructuralPulse`。其餘八個學院在 `CollegeCasts`。施放時不畫普攻光刃。

動畫與特效只讀 `attackFx`、`hurtUntil`、敵人 `state`／`timer`／`hurt`／`hp`。不寫回戰鬥。

## 戰鬥與科系

現場科系表是 `src/game/rpg/data.ts` 的 `DEPARTMENTS`。id 形如 `` `${discipline}-${college}-${index}` ``。土木工程學系是工學院第二筆，discipline 為 `engineering`。

`engineering` 的技能名稱是「結構脈衝」（傷害 40、範圍 12、冷卻 6）。`StructuralPulse` 讀 `attackFx`：範圍用 `attackFx.range`，命中對象用 `attackFx.hits`。其他學院的施放也讀 `attackFx`，各自畫 `CollegeCasts`。普攻光刃在 `src/game/art/vfx/basic-swing.ts`，跟著 0.46 秒攻擊片段從角色右側移到左側，長度約前臂，不跟著 `attackFx.range` 放大。

敵人 id 與種類（`src/game/rpg/data.ts`）：`quiz-1`…`quiz-4`、`report-1`、`report-2`、`exam-1`、`exam-2`、`final-1`。判定半徑仍是 `ENEMY_TYPES[kind].radius + 2.5`。預警圈用這個半徑。

委託面板的 `claim(id)` 只結 `MISSIONS`。同一個 `claimed` 陣列也收校園事件的 `quest-*` id。校園獎勵走 `grantQuestReward`，不另開背包。學期故事裡還有另一個同名函式，兩本帳沒有合併。

狀態卡可見文字來自 `BarReadout.short`（`src/game/rpg/status.ts`），形如「生命 62/108」。小數最多一位。長句 `line`（目前值、最大值、變化）只放在計量條的 `aria-label`。填色是生命 `#e09a8c`、專注 `#8eb8b4`、經驗 `#ddc691`，軌道 `#cfc6b0`，字色沿用 `--ad-ink`。提示畫在長條外面，窄卡用 `flex-wrap` 換行。窄於 700px 時 `.ad-target` 的 `top` 是 268px。

敘事預覽的 `quest-reward` 呼叫既有 `grantQuestReward`。非法效果（`set-hp`、`add-item`、`eval`、`script`、`mutate-save`）整段取消。預覽把結果寫在 `tk-narrative-preview-fixture-v1`。

校園進入點用同一條白名單。差額寫回主存檔的經驗、筆記、學分與 `claimed`。事件旗標、任務節點與已解決事件放在同一份存檔的 `narrative`，不是第二份生命或背包。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。

## 地點

`permanentId` 與 `aliasOf` 在 `src/game/world-data/registry/index.ts` 的 `RegistryEntry`。清冊筆數沒有增刪，精度仍全部 `estimated`。

校園門口的可見步道由 `entranceRoadPath` 從門口走到估計路網上能站的點。不再對準最近的一條垂直線。這不是實測路線，也沒有新的階數。

`form === "gate"` 的建築（大門警衛站、大忠警衛站）畫成兩根門柱加橫樑。`gatePiers` 的門柱寬是 1.5。碰撞只加在門柱上，開口中心可以站。這是估計外形，不是實測門寬。

白樓的種類是 `white-block`。`theme === "arts"` 是 `hip-roof-block`，宿舍是 `dorm-block`，實驗樓是 `lab-block`，運動館是 `sport-hall`，教學樓仍是 `slab-block`。窗帶、名牌、坡頂、宿舍退縮層和實驗樓屋頂設備由 `contextShowsDetail` 決定。高畫質 90 m 內才畫，省電是 48 m。量體一直留著。精度仍是 estimated。

室內路線用既有 `enter("palace")`／`exit()`。宮燈教室 id 是 `palace`。

## 存檔

兩把本地鍵，本輪都沒有改格式：

| 鍵 | 版本欄 | 內容 |
| --- | --- | --- |
| `tamkang-world-v1` | `version: 2`（`SAVE_VERSION`） | 巡禮造訪、光影、音量、畫質、舊背包與科系 |
| `tamkang-rpg-v2` | `snapshot().version === 2` | 生命、專注、任務 `claimed`、建築、背包槽、位置、室內，以及同一份存檔上的 `narrative` 事件記憶 |

寫入是延遲 1.8 秒的本地 `localStorage`。另一個分頁寫入同一鍵時，`onForeignSave` 只把文字放進 `foreignText` 並把 `saveConflict` 設為 true，不直接覆蓋目前進度。玩家再選接受本機或接受外來。這是分頁衝突，不是雲端同步。

靜態建置不要求伺服器，也不含雲端面板、`/api/cloud` 或敘事預覽頁。雲端信封的 `contentVersion: 2` 是這份 RPG 存檔的 `version`，不是敘事 manifest 的 `revision: 1`。`?qa=1` 才掛上 `window.__rpgQA`，正式遊玩不讀它。

## 尚未統一、本輪不刪的兩份科系表

`src/game/departments.ts` 使用 `civil`、`cs` 這類 id。`src/game/rpg/data.ts` 使用 `engineering-工學院-N`。匯入舊檔時 `legacyDepartment` 會試著對名稱。兩份表都還有呼叫端。內容線給出唯一清冊之前，不刪其中一份，也不另做第三份。見 `KNOWN-ISSUES.md` 的 INT-01。
