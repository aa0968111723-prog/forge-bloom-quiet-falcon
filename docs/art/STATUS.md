# 進度狀態

更新：2026-11-11。分支 `cursor/tamkang-art-pipeline-1a71`。
本文件分開報告「遊戲美術完成度」「真實地理精度」「待真機驗收」，不以文件或檔名數量推算完成率。

## 階段：基準盤點 → 資產管線 → 可玩樣板（本輪）

### 實際完成

1. **基準盤點**：`docs/art/BASELINE.md`；改造前五段路線效能與畫面（`docs/art/evidence/baseline/`）。
2. **資產管線**：`art/` 可編輯來源 → `npm run art:export` → `public/game-art/*.glb` + `manifest.json` + `src/game/art/art-manifest.gen.ts`；
   `npm run art:validate -- --rebuild` 檢查缺檔、ID 重複、無效引用、骨架動畫相容、預算、未使用與重建一致；`scripts/art-pipeline.test.mjs` 納入 `npm test`。
3. **精製主角**（`char.student-kit`，玩家角色已改用）：動漫臉（貼圖眼、眉、腮紅）、分束深栗頭髮與小束髮、米白上衣、玉綠開襟外套（領子、11 mm 布料厚度、翻折袖口）、手指、米色短褲、白球鞋（玉綠中底與側條）、帆布背包（揹帶、扣具）與會擺動的小龜吊飾。
   8 段動畫：idle、walk、run、attack、skill、dodge、hurt、interact；由真實事件觸發，依身體部位分層。
   省電畫質改用同骨架、同動畫的 LOD1（`char.student-kit-lod1`）。
4. **考卷怪**（`creature.quiz`，所有 quiz 敵人已改用）：會捲曲的考卷身體、印刷臉、手風琴紙手與鉛筆、折角、環繞小考卷；
   idle／chase／windup（依真實進度）／attack／hurt／defeat；紅筆預警圈＝真實判定半徑；紙片與擊倒碎紙特效。
5. **工程技能「結構脈衝」**：藍圖格 → 桁架波前到真實範圍 → 命中鋼梁沿真實擊退方向 → 消散；冷卻結束的就緒提示；低畫質與 reduced-motion 版本。
6. **截圖與量測工具**：`capture-art.mjs`（turnaround、poses、combat）、`capture-route.mjs`、`?qa=1` 定步時鐘。

### 提交

| 提交 | 內容 |
| --- | --- |
| `cad192d` | 基準盤點、QA store 接口、路線量測 |
| `cbec4f6` | 資產管線、學生角色組主角、分層動畫器、載入回退 |
| `93ed99b` | 考卷怪、結構脈衝、QA 定步時鐘 |
| `bad40fa` | 主角省電 LOD1 |
| （本次文件提交） | 狀態、驗收、來源、問題、交接、證據 |

### 驗收證據

- 自動檢查：typecheck 通過；`npm test` 215 通過（基準 206 + 新增 9）；`art:validate --rebuild` 0 錯誤；`build:site` 通過。詳見 `VALIDATION.md`。
- 主遊戲畫面（定步、真實規則）：`docs/art/evidence/m1/combat-*.jpg`（追擊、預警 30／80 %、出手、受擊、普攻、技能六格時序、擊倒四格）。
- 主角固定光照四面與特寫、六個動作關鍵影格：`docs/art/evidence/m1/protagonist-*.jpg`。
- 一般桌面 Chrome 實際遊玩（人工操作）：`docs/art/evidence/m1/realplay/`（地圖前往宮燈教室、預警圈、結構脈衝命中「命中 1 個目標」、擊倒與掉落）。

### 同主機、同解析度、同路線比較

主機：4 vCPU Xeon、無 GPU、Chrome SwiftShader。手機與 RTX 3060 目標一律 `pending-device`。
資料：`docs/art/evidence/baseline/*.json`（前）、`docs/art/evidence/m1/route/*.json`（後）。

**省電 844×390**（frame median／P95 ms；三角形）

| 段落 | 改造前 | M1（主角 LOD0） | M1 + LOD1（現行） |
| --- | --- | --- | --- |
| 首頁 | 633／700；374 k | 900／917；392 k | 692／833；380 k |
| 戶外 | 675／733；352 k | 775／800；363 k | 650／750；351 k |
| 戰鬥 | 683／750；343 k | 775／1083；355 k | 642／783；344 k |
| 室內 | 33.3／50；15.5 k | 50／66.7；24.2 k | 33.3／50；12.4 k |
| 返回戶外 | 483／583；339 k | 558／683；349 k | 483／550；337 k |
| draw calls（室內） | 16 | 11 | 11 |
| 傳輸（未壓縮） | 1.54 MB／49 檔 | 2.86 MB／51 檔 | 2.35 MB／51 檔 |
| 開頁到標題可用 | 6.4 s | 5.9 s | 6.0 s |

**高畫質 1280×720**（主角 LOD0）

| 段落 | 改造前 | M1 |
| --- | --- | --- |
| 首頁 | 3817／3833；1.91 M；515 calls | 3925／3983；1.93 M；510 calls |
| 戶外 | 3958／4067；2.74 M；508 calls | 4325／4700；2.76 M；493 calls |
| 戰鬥 | 4158／4317；2.75 M；506 calls | 4083／4083；2.77 M；491 calls |
| 室內 | 183／217；28.5 k；23 calls | 200／267；45.9 k；13 calls |
| 返回戶外 | 3658／3817；2.74 M；363 calls | 3617／3683；2.75 M；348 calls |
| 傳輸（未壓縮） | 4.63 MB | 5.95 MB |

判讀：
- 省電畫質：主角 LOD0 讓本主機變慢；改用 LOD1 後回到改造前水準（室內 33.3／50 ms），draw calls 仍較少。
- 高畫質：每段只有 2–4 幀樣本，差異在雜訊範圍；室內三角形增加主要來自主角含陰影的兩次繪製。
- 參考目標（手機省電 median ≤ 33.3／P95 ≤ 50 ms；桌面高畫質 ≤ 16.7／25 ms）尚未在目標裝置量測：`pending-device`。

## 三種完成度（分開報告）

| 面向 | 現況 |
| --- | --- |
| 遊戲美術完成度 | M1 樣板四項已在主遊戲運作（主角、宮燈大道、考卷怪、工程技能），均標 `needs_review`。NPC 系統、report/exam/final、其餘八學院技能、七區製作、公共室內、UI、音效尚未開始。 |
| 真實地理精度 | 未變更：清冊 64 筆（4 alias、60 非 alias）全部 `estimated`；官方來源已確認可連線，但尚未逐筆判讀；不宣稱 1:1。 |
| 待真機驗收 | 手機省電與 RTX 3060 高畫質 FPS、溫度、觸控：`pending-device`。 |

## 未完成與受阻

- 受阻：Blender 往返（無 Blender）、真機量測（無裝置）、授權音效（無來源）、核准概念圖（任務包不在儲存庫）。
- 未完成：見 `BACKLOG.json`（NPC、怪物三類、八學院技能、七區、室內、環境、UI、音效、壓縮）。

## 下一步

見 `CHECKPOINT.json` 的 `next_action`：先處理 M1 needs_review 的主角鞋楦與手部、被牆擋住時的步行表現，
再做 NPC 角色組（體型、髮型、服裝、配件 + 遊戲角色清冊對應）與 report／exam／final 三類怪物。
