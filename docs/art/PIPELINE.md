# 美術資產管線

```
art/                     可編輯來源（TypeScript 程序化來源 + spec）
  assets.json            資產紀錄（唯一來源）：id、名稱、分類、版本、來源檔、授權、輸出、單位、pivot、朝向、動畫、預算、runtime 使用位置、狀態、證據
  index.ts               id → builder 對照
  shared/                builder（合併、蒙皮、atlas UV、量化）、loft／sweep、raster（程序貼圖 + PNG）
  characters/student-kit/  學生角色組（主角預設）
  creatures/quiz/        突擊小考
public/game-art/         遊戲輸出（GLB）與 manifest.json（含量測值，自動產生）
src/game/art/            runtime：載入（assets.ts）、錯誤回退（ArtBoundary）、動畫（character/animator.ts）、角色、怪物、特效
scripts/art/             匯出、驗證、截圖與路線量測
docs/art/                方向、來源、進度、驗收與交接
```

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run art:export` | 從 `art/` 重建所有 GLB，嵌入程序貼圖，量測後寫入 `public/game-art/manifest.json` 與 `src/game/art/art-manifest.gen.ts` |
| `npm run art:export -- <id>` | 只重建一件 |
| `npm run art:validate` | 驗證紀錄、輸出、GLB 結構、預算與引用 |
| `npm run art:validate -- --rebuild` | 另外在記憶體重新匯出，要求與已提交 GLB 位元組完全相同 |
| `node scripts/art/capture-art.mjs <url> <dir> <turnaround\|poses\|combat\|avenue>` | 以真實遊戲畫面截圖（需 `?qa=1` 開發或預覽伺服器） |
| `node scripts/art/capture-route.mjs <url> <dir> --tier high\|low --label x` | 首頁 → 戶外 → 戰鬥 → 室內 → 返回戶外 的效能量測 |

`npm test` 也會執行 `scripts/art-pipeline.test.mjs`（驗證器、重建一致性、壞檔偵測、蒙皮／動畫／腳底滑動量測）。

## 驗證項目（`scripts/art/validate-assets.mjs`）

- 紀錄：必要欄位、id 不重複、分類與狀態合法、來源檔存在。
- 輸出：檔案存在；`manifest.json` 與 runtime 對照表的 sha256 與檔案一致（否則視為過期）。
- GLB：accessor、bufferView、material、node、skin、texture、sampler 引用全部有效；動畫通道目標存在；
  蒙皮資產的動畫只能驅動 skin joint；四元數為單位長度；宣告的動畫全部存在。
- 預算：三角形、位元組、貼圖數與貼圖尺寸。
- 引用：紀錄列出的 runtime 檔存在且確實提到該 id；`src/` 中 `useArtModel`／`preloadArt`／`artUrl` 使用的 id 必須存在。
- 未使用：`public/game-art/` 內沒有紀錄擁有的檔案為錯誤；沒有 runtime 使用位置的資產為警告（若狀態是 integrated 則為錯誤）。

## 輸出格式

- 每件角色／怪物一個蒙皮網格、一個材質、一張 512² atlas（PNG 內嵌於 GLB），一個 draw call。
- 頂點經焊接後量化為 glTF 核心格式：COLOR_0 RGBA8、TEXCOORD_0 UNORM16、JOINTS_0 UINT8、WEIGHTS_0 UNORM8（權重和固定為 1）。
- 座標：1 單位 = 1 公尺，+Y 上，模型面向 +Z（角色左手 +X），原點在地面。
- 匯出在 Node 22 + three r185 下可重現；`--rebuild` 驗證會抓出來源與輸出不同步。

## Runtime

- `useArtModel(id)` 以帶內容雜湊的 URL 載入 GLB，每個實例複製骨架與材質（幾何與貼圖共用），套用全場 toon 光照補丁；卸載時只釋放實例自己的材質。
- `ArtBoundary` 捕捉載入失敗：在遊戲訊息列顯示「美術資產「id」載入失敗，已改用備用外形。」並改畫指定的回退（主角回退為舊程序化學生、考卷怪回退為舊外形）。
- 動作只由真實事件觸發（`attackFx`、`hurtUntil`、控制器接受的閃避與互動、敵人 `state/timer/hurt/hp`），動畫與特效不寫回戰鬥狀態。

## 新增一件資產

1. 在 `art/<分類>/<id>/` 寫 builder（只用 Node 可直接執行的 TypeScript，相對匯入帶 `.ts`）。
2. 在 `art/index.ts` 登記 builder，在 `art/assets.json` 加紀錄（含預算與 runtime 位置）。
3. `npm run art:export`，再 `npm run art:validate -- --rebuild`。
4. 在 runtime 以 `useArtModel("<id>")` 使用並包上 `ArtBoundary`。
5. 以 `capture-art.mjs` 留固定光照角度與時序畫面，更新紀錄的 `evidence`。

## Blender

本機沒有 Blender（見 BASELINE.md）。GLB 是標準 glTF 2.0，可直接匯入 Blender 4.x 檢視與修改；
若改以 Blender 為來源，將 `.blend` 放在 `art/` 對應目錄、把紀錄的 `source.type` 改為 `blender`，
並新增匯出腳本，validate 規則不變。
