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

八學院技能外形在 `CollegeCasts`，讀既有 `attackFx`。工程「結構脈衝」仍是 `StructuralPulse`。

動畫與特效只讀 `attackFx`、`hurtUntil`、敵人 `state`／`timer`／`hurt`／`hp`。不寫回戰鬥。

## 戰鬥與科系

現場科系表是 `src/game/rpg/data.ts` 的 `DEPARTMENTS`。id 形如 `` `${discipline}-${college}-${index}` ``。土木工程學系是工學院第二筆，discipline 為 `engineering`。

`engineering` 的技能名稱是「結構脈衝」（傷害 40、範圍 12、冷卻 6）。`StructuralPulse` 讀 `attackFx`：範圍用 `attackFx.range`，命中對象用 `attackFx.hits`。其他 discipline 仍用 `SkillEffects` 的舊幾何。基本攻擊不走專用特效。

敵人 id 與種類（`src/game/rpg/data.ts`）：`quiz-1`…`quiz-4`、`report-1`、`report-2`、`exam-1`、`exam-2`、`final-1`。判定半徑仍是 `ENEMY_TYPES[kind].radius + 2.5`。預警圈用這個半徑。

主遊戲獎勵仍走 `claim(id)`：`claimed` 已有該任務 id 就返回。

敘事預覽的 `quest-reward` 呼叫既有 `grantQuestReward`。非法效果（`set-hp`、`add-item`、`eval`、`script`、`mutate-save`）整段取消。預覽把結果寫在 `tk-narrative-preview-fixture-v1`，不寫 `tamkang-rpg-v2`。`MAIN_INTEGRATION` 是 false，`AdventureApp` 沒有接這條線。

## 地點

`permanentId` 與 `aliasOf` 在 `src/game/world-data/registry/index.ts` 的 `RegistryEntry`。本輪沒有改清冊。美術線記錄 64 筆仍全部 `estimated`。

室內路線用既有 `enter("palace")`／`exit()`。宮燈教室 id 是 `palace`。

## 存檔

兩把本地鍵，本輪都沒有改格式：

| 鍵 | 版本欄 | 內容 |
| --- | --- | --- |
| `tamkang-world-v1` | `version: 2`（`SAVE_VERSION`） | 巡禮造訪、光影、音量、畫質、舊背包與科系 |
| `tamkang-rpg-v2` | `snapshot().version === 2` | 生命、專注、任務 `claimed`、建築、背包槽、位置、室內 |

寫入是延遲 1.8 秒的本地 `localStorage`。另一個分頁寫入同一鍵時，`onForeignSave` 只把文字放進 `foreignText` 並把 `saveConflict` 設為 true，不直接覆蓋目前進度。玩家再選接受本機或接受外來。這是分頁衝突，不是雲端同步。

靜態建置不要求伺服器。`?qa=1` 才掛上 `window.__rpgQA`，正式遊玩不讀它。

## 尚未統一、本輪不刪的兩份科系表

`src/game/departments.ts` 使用 `civil`、`cs` 這類 id。`src/game/rpg/data.ts` 使用 `engineering-工學院-N`。匯入舊檔時 `legacyDepartment` 會試著對名稱。兩份表都還有呼叫端。內容線給出唯一清冊之前，不刪其中一份，也不另做第三份。見 `KNOWN-ISSUES.md` 的 INT-01。
