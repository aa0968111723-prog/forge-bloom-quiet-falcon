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

## 普攻光刃（已在 main）

來源 `879ffdf` 接到 `main` `394b86a`。衝突三處，都用手解：測試檔同時留下骨架釋放、NPC 組裝與光刃位移，沒有把已刪的 `instance.ts` 加回來。美術線自己的下一步寫的是已經做完的清冊，所以藝術檢查點維持較新的 ART-090。驗收段則把光刃與後來的清冊、光照都留下。

`npm run typecheck` 通過。`npm test` 246 通過。`scripts/art-runtime.test.mjs` 5 通過，其中光刃從右側移到左側，縮減動態時停在揮完的位置。

宮燈大道、高畫質、定步、`attack(false)`。判定半徑仍是 3.7，`skill` 是 false，`pageErrors` 空。畫面裡光刃是一條短弧：0.07 秒被身體擋住，0.13 秒在身前，0.27 秒移到左側，0.47 秒只剩很少的殘光。化學技能 `attack(true)` 命中 1，範圍 10，地面仍是兩道紫色弧，不是這條普攻刃。

## 跨系統路線（已在 main）

靜態開發站 `http://127.0.0.1:8086/?qa=1&q=low`，全新瀏覽器。過程中沒有請求 `/api/`。`pageErrors` 空。主機是 SwiftShader。

| 步驟 | 結果 |
| --- | --- |
| 離線標題 | 「開始學期」可按 |
| 角色與校園 | 化學學系 `science-理學院-2`，人在 (0, 82) |
| 大門事件 | 陳予的對話出現「可以只告訴我今天會用到的路嗎？」 |
| 獎勵一次 | 經驗 20，筆記 19，`claimed` 含 `quest-orient-gate` |
| 再次進入 | 不再打開對話，直接進大門室內，經驗仍是 20 |
| 戰鬥 | 既有 `attack(false)`，突襲小考 65→45，經驗不變 |
| 存檔重載 | 「繼續學期」後科系、經驗 20、筆記 19 都在 |
| 未登入 | 雲端計畫是 `local_only` |
| 登入同步 | 未確認的第一次上傳是 409 `first_sync_required`，本機不變；確認後 revision 1 |
| 第二客戶端 | 下載到經驗 20、化學學系、同一個任務 id |
| 衝突 | 同時寫入 200 與 409 `revision_conflict` |
| 斷線 | 離線再寫只進佇列，雲端經驗不是那個未送出的值 |
| 登出 | 讀取雲端存檔是 401，本機科系還在 |

## 靜態建置（main `55eb7b9`）

`npm run build:site` 通過。產物沒有 `cloud-save`、`CloudSaveDock`、`雲端同步`、`DATABASE_URL`、`/api/cloud`、`better-auth` 或 `tk-narrative-preview-fixture`。校園對話「校園裡的人」與 `quest-orient-gate` 在包裡。

預覽 `http://127.0.0.1:8093/?qa=1&q=low`。標題是「淡江世界 · 五虎崗異象」，「開始學期」可按。沒有 `/api/` 請求，`pageErrors` 空。

同一份預覽再跑完整條路線：化學學系、經驗 20、筆記 19、`quest-orient-gate` 只記一次、第二次進入進室內、突襲小考 65→45、重載後仍在。這份存檔第一次上傳 revision 1，第二客戶端下載到同一科系，同時寫入 200 與 `revision_conflict`，斷線只進佇列，登出後 401。

## 狀態卡短標籤（本輪）

來源 PR #24 `aeda26c` 接到 `b567b60`。衝突在美術檢查點、狀態、驗收與截圖腳本。清冊、光照、室內與普攻情境都留下，另外加上 `hud`。美術線自己的下一步還把已經做完的普攻當成待辦，所以檢查點改成：短標籤已進，剩下技能圖示、地圖標記、受擊回饋。

`npm run typecheck` 通過。`npm test` 246 通過。`npm run build:site` 通過。狀態列測試仍要求 `line` 含目前值、最大值、變化，並要求 `short` 不含「目前值」。專注 41.28 的短標籤是「專注 41.3/100」。

瀏覽器 `http://127.0.0.1:8087/?qa=1&q=low`，定步在突襲小考旁邊，時鐘凍結。1280×720 與 390×780：

| 視窗 | 可見文字 | 位置 |
| --- | --- | --- |
| 1280×720 | 生命 62/108、專注 40/100、經驗 20/180 | 目標卡 top 24，與左上狀態卡不重疊 |
| 390×780 | 同上 | 目標卡 top 208，狀態卡 bottom 188 |

把生命改成 20 之後，標籤變成「生命 20/108」，填色寬度跟著變。三條的 `aria-label` 仍有「目前值」與「最大值」。`pageErrors` 空。

## 短標籤狀態卡上的跨系統路線（本輪）

遊戲程式仍是 `803fe62`。開發站 `http://127.0.0.1:8087/?qa=1&q=low`，全新瀏覽器。離線過程沒有 `/api/` 請求。`pageErrors` 空。大門對話打開時，狀態卡可見文字是「生命 100/100」「專注 100/100」。

| 步驟 | 結果 |
| --- | --- |
| 離線標題 | 「開始學期」可按 |
| 角色與校園 | 化學學系 `science-理學院-2`，人在 (0, 82) |
| 大門事件 | 陳予的對話出現「可以只告訴我今天會用到的路嗎？」 |
| 獎勵一次 | 經驗 20，筆記 19，`claimed` 含 `quest-orient-gate` |
| 再次進入 | 不再打開對話，直接進大門室內，經驗仍是 20 |
| 戰鬥 | 既有 `attack(false)`，突襲小考 65→45，經驗不變 |
| 存檔重載 | 「繼續學期」後科系、經驗 20、筆記 19 都在 |
| 未登入 | 雲端計畫是 `local_only` |
| 登入同步 | 確認後 revision 1，經驗 20 |
| 第二客戶端 | 下載到經驗 20、化學學系 |
| 衝突 | 同時寫入 200 與 409 `revision_conflict`，伺服器 revision 2 |
| 斷線 | 離線再寫只進佇列，雲端經驗是 23 |
| 登出 | 讀取雲端存檔是 401 |

## 門口步道（本輪）

來源 PR #27 `f48a2c5` 接到 `c59aaac`。衝突在美術文件與截圖腳本。狀態卡的 `hud` 情境留下，並加上 `links`。

`entranceRoadPath` 從門口走到估計路網上 `resolveCollision` 允許站立的點。`npm run typecheck` 通過。`npm test` 248 通過。`scripts/campus-links.test.mjs` 2 通過：41 個門口的步道起點是門口，終點距路網小於 1.6 m，路網是一個相連分量。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8094/?qa=1&q=low` 定步。視聽教育館與正門的步道沿量體外側接到路，`pageErrors` 空。同一站再跑跨系統路線，結果與上一輪相同：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 狀態提示換行（本輪）

來源 `1340a89` 接到 `7ffe826`。衝突在美術檢查點、驗收與截圖腳本。門口步道的 `links` 情境留下，並在 `hud` 裡加上受傷畫面。

提示改放在 `.ad-readout`，長條本身仍 `overflow: hidden`。`npm run typecheck` 通過。`npm test` 248 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8095/?qa=1&q=low`。生命先到 62、專注到 40，再改成生命 10、專注 48、並設受傷。1280×720 與 390×780 都讀到「生命 10/100」「受傷」「低生命」「專注 48/100」「恢復」。三個提示都不在長條節點裡。390px 時「低生命」換到下一行，目標卡上緣 268，狀態卡下緣 214。`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 開口門柱（本輪）

來源 `d930724` 接到 `b55f311`。衝突只在美術檢查點的下一步。狀態提示換行與門口步道都留下。截圖腳本加上 `gates`。

`form === "gate"` 畫兩根寬 1.5 的門柱與橫樑。碰撞只加在門柱。`npm run typecheck` 通過。`npm test` 249 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8096/?qa=1&q=low`，1280×720。人站在大門警衛站與大忠警衛站的開口裡，路從兩根紅柱中間過。`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 白樓、覺軒與遠距細節（本輪）

來源 `18dee4c` 接到 `528a56f`。衝突在美術文件、截圖腳本、次要建築種類與場景元件。開口門柱的 `gate` 留在 `campusKind` 裡。截圖腳本同時留下 `gates` 和 `halls`。

`contextShowsDetail` 在高畫質 90 m、省電 48 m 內才畫窗帶、名牌和坡頂。`npm run typecheck` 通過。`npm test` 251 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8097/?qa=1&q=low`，1280×720。近處白樓看得到平頂和窗帶。鏡頭拉到約 160 m 後，平頂和窗帶不在畫面上，量體還在。覺軒近處是灰牆加綠瓦坡頂。`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 宿舍、實驗樓與運動館量體（本輪）

來源 `748608a` 接到 `eaa9b72`。衝突在美術文件、截圖腳本、次要建築種類與場景元件。`gate` 留在種類裡。截圖腳本同時留下 `gates` 和 `themes`。

`theme === "arts"` 走綠瓦坡頂。松濤是 `dorm-block`，化學館是 `lab-block`，游泳館是 `sport-hall`，慧文仍是 `slab-block`。精度仍是 estimated。`npm run typecheck` 通過。`npm test` 252 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8098/?qa=1&q=low`。1280×720 與 390×780：松濤是暖色量體，化學館是冷灰且屋頂有一塊設備，游泳館是偏低的綠灰量體。人站在門口。`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 教學樓量體（本輪）

來源 `d0d1cfa` 接到 `3204c78`。衝突在美術文件、截圖腳本、次要建築種類與場景元件。來源把 `form === "gate"` 改回 `slab-block`，這次改回 `gate`。截圖腳本同時留下 `gates` 與 `study`。

教育館與慧文是 `study-block`：深色基座加淺色上層，橫樑掛 `context-detail`。大門仍是 `gate`。精度仍是 estimated。`npm run typecheck` 通過。`npm test` 252 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8099/?qa=1&q=low`。1280×720 與 390×780：教育館看得到深色基座、淺色上層與橫樑，名牌寫著教育館。1280×720 的大門與大忠警衛站仍是兩根紅柱加綠瓦，人站在開口裡。`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。重載後的畫面在這台機器上超過預設 30 秒才截完，行為斷言在截圖前已經通過。

## 技能圖示與受擊邊緣（本輪）

來源 `dde692f` 接到 `b1e6ba9`。衝突只在美術檢查點與驗收文。教學樓仍是深色基座加淺色上層，開口門柱留著。截圖腳本加上 `icons`，`gates` 與 `study` 留著。

`SKILL_GLYPH` 九個學院各一個不重複的 lucide 名稱。工程是 `DraftingCompass`。`.ad-hurt` 改成 `inset 0 0 72px 18px #b04c4799`。`npm run typecheck` 通過。`npm test` 253 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8100/?qa=1&q=low`。1280×720 與 390×780：土木工程快捷欄的圖示類名是 `lucide-drafting-compass`，生命改到 40 時狀態卡讀到「受傷」，邊緣陰影是 `rgba(176, 76, 71, 0.6) 0px 0px 72px 18px inset`。九個學院切換後的圖示類名分別是 drafting-compass、flask-conical、scroll-text、coins、languages、graduation-cap、globe、cpu、heart-pulse。`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 地圖七區圖例（本輪）

來源 `944b2c9` 接到 `b9c4477`。衝突在美術待辦、檢查點與驗收文。技能圖示與受擊邊緣留著。教學樓仍是深色基座加淺色上層，開口門柱留著。截圖腳本加上 `zones`，`icons`、`gates` 與 `study` 留著。

`ZONE_MARK` 七個顏色與名稱都不重複。宮燈教室是軸線。玩家在 `(0, -80)` 附近最近的分區是 `axis-54`。`npm run typecheck` 通過。`npm test` 254 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8101/?qa=1&q=low`。1280×720 與 390×780 都打開校園地圖。圖例是軸線、書圖、理工、教學、文藝、運動、生活。建物有分區描邊，課程標記仍在。`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 高畫質戶外三角形（本輪）

來源 `dd628b1` 接到 `4f3239a`。衝突在美術檢查點、驗收文與截圖腳本。七區截圖 `zones` 留著，並加上 `budget`。技能圖示、教學樓量體與開口門柱留著。

高畫質 `vegetationRange` 從 110 改成 48。省電仍是 `simpleTrees`，70 m 不是細模半徑。`npm run typecheck` 通過。`npm test` 254 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8102/?qa=1&q=high`，站在 `(0, -80)`。1280×720 是 1,560,511 三角形、458 draw calls。390×780 是 1,558,783 三角形、388 draw calls。兩次都低於 1.6 M，`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。戰鬥、室內與其他路段的三角形沒有重測。

## 標題鏡頭（本輪）

來源 `eab68c7` 接到 `1e980af`。衝突在美術檢查點與已知問題。KI-10 改成已處理，KI-11 仍是 1.56 M 已處理。截圖腳本加上 `title`，`budget` 與 `zones` 留著。

廣場環形樹在標題鏡頭 16 m 內不種。測試要求 14 m 內沒有喬木。`npm run typecheck` 通過。`npm test` 255 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8103/?qa=1&q=high`。1280×720 拿開標題卡後看得到驚聲銅像、廣場座椅和宮燈教室，右側不再被一株榕樹填滿。390×780 拿開標題卡後看得到宮燈與廣場步道。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 商管大樓量體（本輪）

來源 `70dd633` 接到 `3950e2a`。衝突在美術檢查點與驗收文。標題鏡頭留在第 15 輪，商管大樓記成第 16 輪。截圖腳本加上 `business`，`title` 與 `budget` 留著。大門仍是 `gate`。

`business-building` 是 `study-block`，精度 estimated。`npm run typecheck` 通過。`npm test` 255 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8104/?qa=1&q=high`，站在 `(132, -158)`。1280×720 與 390×780 都看得到深色基座和淺色上層。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 標示用字（本輪）

來源 `9a7ae33` 接到 `95bd4d4`。衝突在美術檢查點、交接、狀態與截圖腳本。商管大樓留在第 16 輪，標示用字記成第 17 輪。截圖腳本加上 `signs`，`business` 與 `title` 留著。大門仍是 `gate`。

科學館顯示名稱是「騮先紀念科學館」，泳館是「紹謨紀念游泳館」。清冊精度仍是 estimated，`fieldChecked` 仍是 false。沒有複製官方標示表。`npm run typecheck` 通過。`npm test` 256 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8105/?qa=1&q=high`。1280×720 與 390×780 的名牌都是這兩個新名稱。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。

## 金幣與蓄力刃（本輪）

來源 `07d1a0b` 接到 `5f6080b`。衝突在美術檢查點、交接、狀態與驗收文。標示用字留在第 17 輪，金幣與蓄力刃記成第 18 輪。截圖腳本在技能飛行與命中時把商管金幣拉近，`signs`、`business` 與 `title` 留著。大門仍是 `gate`。

只有一個命中點時，金幣彼此距離超過 0.8 m。蓄力幀刃的 local z 在 -0.5 之前。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 256 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8106/?qa=1&q=high`。1280×720 與 390×780 的商管飛行幀都看得到散開的金幣，普攻接觸幀看得到光刃。四次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。`pageErrors` 空。

## 淡水遠景（本輪）

來源 `4bd41a4` 接到 `abef230`。衝突在美術檢查點、交接與狀態。金幣留在第 18 輪，遠景記成第 19 輪。截圖腳本加上 `vista`，`signs` 與金幣近景留著。大門仍是 `gate`。

近岸是 `SHORE_X` -112。站到河上會被推回。對岸 46 個街廓和四座山脊都在岸線以西。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 257 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8107/?qa=1&q=high`，站在牧羊草坪 `(-36, -348)` 往西。1280×720 與 390×780 都看得到河面和山脊。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。`pageErrors` 空。

## 河角存檔（本輪）

來源 `f7584b3` 接到 `8d9b979`。沒有衝突。近岸碰撞沒有改範圍。世界邊界把人夾完之後，若 x 仍在 `SHORE_X` 以西，就拉回岸邊加上角色半徑。南北兩端存在水裡的位置不會再被推回去。

`npm run typecheck` 通過。`npm test` 258 通過。`npm run build:site` 通過。畫面沒有改，沒有重拍。

瀏覽器 `http://127.0.0.1:8108/`。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401。`pageErrors` 空。

## 本輪沒有驗的項目

- 手機與真機上的雲端面板點擊。本輪在 Node 開發頁讀到面板文字，沒有在手機上操作
- 內容版本不相容
- 行走中的 NPC 套件特寫、非工程學院技能逐一截圖
- 手機與 RTX 3060：`pending-device`。不填估計 FPS
- reduced-motion 另拍
- 正式部署
