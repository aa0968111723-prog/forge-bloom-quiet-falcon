# 驗收

只記錄本輪在整合工作區實際跑過的結果。畫面數字來自主機 SwiftShader，不是手機或桌面 GPU。

整合分支含美術 PR #6（`017b755`）與頭部 glance、骨架釋放修正。

## 自動檢查

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm test` | 217 通過 / 0 失敗（美術線 215，另加 glance 不累加、骨架釋放且不釋放共享幾何） |
| `npx eslint`（本次改動的 `src/game/art` 與 `scripts/art-runtime.test.mjs`） | 0 錯誤 |
| `npm run build:site` | 通過。既有 >500 kB chunk 提示仍在。`AdventureApp` 約 578 kB |

`npm test` 內含美術驗證器與位元組重建檢查。沒有刪測試。

儲存庫沒有 GitHub Actions。`main` 的 branches API 回報 `protected: false`。分支保護端點對此 token 為 403，rulesets 清單是空的。CodeRabbit 在 PR #6 為 skipped。本機結果不能冒充 GitHub check；目前也沒有必須通過的 check。

## 行為路線（靜態預覽）

`npm run preview:site` 後實際執行：

`PW_CHROMIUM_PATH=/usr/bin/google-chrome ROUTE_SAMPLE_MS=800 node scripts/art/capture-route.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/art-m1-route --tier low --label integration-low`

結果已放進 `docs/integration/evidence/`。

主機：4 vCPU，WebGL 為 SwiftShader。視窗 844×390，`?qa=1&q=low`。`pageErrors` 為空。

| 段落 | 觀察 |
| --- | --- |
| 標題 | 可操作。frame median 441.65 ms（本機，非目標裝置） |
| 戶外 | 進入學期，科系為土木工程學系，宮燈大道場景在 |
| 戰鬥 | `quiz-2` 生命 65 → 25，狀態 chase；畫面上「結構脈衝 · 命中 1 個目標」，技能冷卻 6 秒。玩家生命 100 |
| 室內 | `enter("palace")` 後宮燈教室 1 樓，可見新主角後腦（深色束髮）。draw calls 11，三角形 12352 |
| 返回戶外 | `exit()` 後回到宮燈教室入口，角色仍在，提示「進入宮燈教室」 |

傳輸 51 個資源、約 2.35 MB 未壓縮，其中 GLB 2 個。與美術線省電路線的傳輸量同一量級。

截圖：`docs/integration/evidence/integration-low-1-title.png` 到 `integration-low-5-outdoor-return.png`。原始數字：`integration-low.json`。

## 合併後（`main` `dff98e3`）

合併樹 `b80465a2` 與整合 head `a2308ad` 相同。在這個 checkout 上實際再跑：

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm test` | 217 通過 / 0 失敗 |
| `npm run build:site` | 通過。既有 >500 kB 提示仍在 |

瀏覽器五段路線沒有重跑。合併沒有改遊戲程式。

## 合併後修正（`main` `d180616`）

PR #8。暫停時考卷怪預警不再自行填滿。`1ad31aa` 上 `npm test` 218 通過、`build:site` 通過。合併樹與該提交相同，合併 checkout 再跑一次 `npm run typecheck` 通過。

## 美術 M2（整合分支 `be6fdd6`，尚未進 main）

來源 `cursor/tamkang-art-pipeline-1a71` @ `8d5ffd0`，基底 `df3611a`。工作區 `/tmp/worktrees/art-m2`。

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm test` | 225 通過 / 0 失敗 |
| `npx eslint`（`assets.ts`、`Protagonist.tsx`、`release.ts`、`art-runtime.test.mjs`） | 0 錯誤 |
| `npm run build:site` | 通過 |

靜態預覽 `http://127.0.0.1:8090/`。省電路線 844×390，`?qa=1&q=low`，SwiftShader。`pageErrors` 空。`quiz-2` 生命 65→25，狀態 chase，玩家生命 100。畫面有「結構脈衝 · 命中 1 個目標」。室內為宮燈教室 1 樓，可見主角。`exit()` 後回到戶外。證據：`docs/integration/evidence/m2/integration-low.json` 與五張截圖。

另一次走動，沒有載入失敗提示：

| 對象 | 畫面 | 存檔狀態 |
| --- | --- | --- |
| `report-1` | 分組報告聚合體，深色紙疊 | 145/145，chase |
| `exam-1` | 期中考監視者 | 240/240，chase |
| `final-1` | 期末・截止日，時鐘臉 | 520/520，chase |

宮燈大道那張朝向沒有對上移動中的 NPC，不能把它當成 NPC 外觀已拍到。NPC 套件有接上 `Npcs.tsx`，本輪沒有另拍到行走中的人。八學院技能外形除工程「結構脈衝」外，本輪沒有逐一截圖。

合併後 `main` `df63d01` 與這次驗收的遊戲提交 `be6fdd6` 只差文件。在 `df63d01` 上再跑 `npm run typecheck` 通過。PR #10 顯示已合併。合併 API 403；`main` 未受保護，所以快轉推送，沒有強推。

## 後端雲端存檔（整合工作區，尚未進 main）

來源 `feature/backend-game-services` @ `a38ef8e`，接到 `main` `0eea3cf`，沒有衝突。`package.json` 與存檔 schema 沒有改。遷移 `0003_rpg_saves.sql` 只新增表。

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm test` | 227 通過 / 0 失敗。其中 `rpg cloud save persists, conflicts, and stays optional` 通過 |
| `npm run build:site` | 通過。`dist` 沒有 `cloud-save`、`雲端同步` 或 `DATABASE_URL` |

流程腳本在本機 PGLite 上實際做了：未登入只留本機；沒有 `confirmFirstSync` 時 409 且本機不變；第二個客戶端要下載才寫入；同時寫入一個成功、一個 `revision_conflict`；敗方可以改留雲端或改留本機；同一 `requestId` 重送不增加 revision；獎勵回執只記一次；離線佇列不會在別的帳號登入時送出；session 過期後讀取是 401；進行中的內容更新保持目前版本。

Node 開發頁 `http://127.0.0.1:8080/` 看得到「雲端同步（選配）」與「尚未同步。本機進度不會自動上傳。」開啟後 `pageErrors` 為空。修正前，開發模式會對五個 NPC 預設丟出零件不符；`assemble` 改成第二次沿用已合併的 mesh。

## 學院施法姿勢（整合工作區，尚未進 main）

來源 `cursor/college-poses-campus-1a71` @ `c1a3bb3`，接到 `main` `f842ede`。

衝突：對方先前把卸載改回已刪的 `instance.ts`。這次只留 `releaseArtInstance`，測試改呼叫它。主角 glance 仍先還原剪輯姿勢。`skill-${discipline}` 的播放留著。工程沒有同名剪輯時回到 `skill`。

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm test` | 228 通過 / 0 失敗 |
| `npm run build:site` | 通過 |

靜態預覽選化學學系（`science-理學院-2`）。技能後 `__characterTest.action` 是 `skill-science`，`attackFx.skill` 為 true，命中 1 個。`quiz-2` 生命 65→13，與科學傷害 52 一致。畫面「共振反應 · 命中 1 個目標」，冷卻 7 秒。`pageErrors` 空。SwiftShader。

## 敘事預覽（整合工作區，尚未進 main）

來源 `feature/game-content-world` @ `54a997e`，接到 `main` `c95d9c3`。衝突只有 `routeTree.gen.ts`：雲端、health、ready、auth 都留著，並加上 `/narrative`。

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm test` | 239 通過 / 0 失敗 |
| `npm run build:site` | 通過。靜態 `dist` 沒有 narrative 字樣 |

Node 開發頁 `http://127.0.0.1:8081/narrative`。樣板進入大門警衛站，選「可以只告訴我今天會用到的路嗎？」。經驗 20、筆記 1、已結算 `quest-orient-gate`、旗標 `gate-asked-map`、任務節點 `quest-orient-gate:done`。`tamkang-rpg-v2` 沒有被寫入。進度在 `tk-narrative-preview-fixture-v1`，標 `local-fixture-only`。`pageErrors` 空。交談按鈕在結算後不再出現。

`AdventureApp` 沒有 import 敘事。這不是主校園裡的事件。

## 校園進入點（整合分支，尚未進 main）

基底 `main` `51bbe4d`。走到大門警衛站按進入，先出現陳予的對話。選「可以只告訴我今天會用到的路嗎？」。存檔經驗 20、筆記 19（開局 18 加這次 1）、`claimed` 是 `quest-orient-gate`、`narrative.resolved` 含 `evt-gate-orientation`、旗標 `gate-asked-map`。沒有寫 `tk-narrative-preview-fixture-v1`。再按進入會進大門警衛站 1 樓，不再出現交談。`pageErrors` 空。

`npm run typecheck` 通過。`npm test` 244 通過 / 0 失敗。帶著 `narrative` 的存檔仍通過雲端 `validateRpgDocument`。

世界時間對到敘事時鐘：晴天早上、陰天午後、夕陽傍晚、夜晚、雨天。學期階段維持 `week-1`。

## 學院地面施法（整合分支，尚未進 main）

來源 `cursor/college-cast-ground-1a71` @ `1b0e78e`，接到 `main` `d8cb6dc`。沒有衝突。

地面施法整組 `y` 加 `GROUND_CLEARANCE`（0.16）。資訊學院括號先轉成非索引幾何再合併。

`npm run typecheck` 通過。`npm test` 244 通過。`scripts/art-pipeline.test.mjs` 17 通過。開發頁選化學學系後按技能，專注下降、冷卻 7 秒，地面看得到淡紫色環。`pageErrors` 空。

## 校園清冊快照（已在 main）

來源 head 在合併前從 `3c85358` 進到 `bb219f5`。後一筆只加大道四個時段的記錄。接到 `main` `c17d276` 沒有衝突，也沒有改遊戲程式。

`npm run typecheck` 通過。`npm test` 245 通過。`scripts/campus-registry.test.mjs` 11 通過。快照筆數與基準一致，每一列精度仍是 `estimated`，沒有列被標成 surveyed。

## 普攻光刃（整合分支，尚未進 main）

來源 `879ffdf` 接到 `main` `394b86a`。衝突三處，都用手解：測試檔同時留下骨架釋放、NPC 組裝與光刃位移，沒有把已刪的 `instance.ts` 加回來。美術線自己的下一步寫的是已經做完的清冊，所以藝術檢查點維持較新的 ART-090。驗收段則把光刃與後來的清冊、光照都留下。

`npm run typecheck` 通過。`npm test` 246 通過。`scripts/art-runtime.test.mjs` 5 通過，其中光刃從右側移到左側，縮減動態時停在揮完的位置。

宮燈大道、高畫質、定步、`attack(false)`。判定半徑仍是 3.7，`skill` 是 false，`pageErrors` 空。畫面裡光刃是一條短弧：0.07 秒被身體擋住，0.13 秒在身前，0.27 秒移到左側，0.47 秒只剩很少的殘光。化學技能 `attack(true)` 命中 1，範圍 10，地面仍是兩道紫色弧，不是這條普攻刃。

## 本輪沒有驗的項目

- 手機與真機上的雲端面板點擊。本輪在 Node 開發頁讀到面板文字，沒有在手機上操作
- 內容版本不相容
- 行走中的 NPC 套件特寫、非工程學院技能逐一截圖
- 手機與 RTX 3060：`pending-device`。不填估計 FPS
- reduced-motion 另拍
- 正式部署
