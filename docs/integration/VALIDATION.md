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

## 路線重測（本輪）

來源 PR #56 的數字來自更早的開發頁，沒有抄進這棵樹。這次用 `scripts/art/capture-route.mjs` 在靜態頁 `http://127.0.0.1:8108/` 重測，高畫質 1280×720，遊戲程式 `7507c59`。`pageErrors` 空。

標題 1,204,683、戶外 1,562,527、戰鬥 1,495,745、室內 46,548、返回 1,437,689。戶外四段都低於 1.6 M。幀時間是 SwiftShader，戶外只有 2 到 3 幀。遊戲程式沒有改，沒有重跑跨系統路線。

## 手機圖示（本輪）

來源 `2b8f9fb` 接到 `ea5aef4`。衝突在美術檢查點、交接、狀態與驗收文。路線重測留在第 20 輪，手機圖示記成第 21 輪。截圖腳本加上 `phone`，`vista` 留著。大門仍是 `gate`。

窄於 700px 時 `.ad-icon` 是 44×44，快捷欄 svg 是 24×24。觸控且窄於 700px 的快捷鈕是 44px，不再縮到 38px。室內列按鈕的最小邊是 44px。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 259 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8109/?qa=1&q=high`。390×780 量到工具鈕 44×44、快捷圖示 24×24。1280×720 量到工具鈕 42×42、技能圖示 21×21。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 雨的畫質（本輪）

來源 `7f9fbe4` 接到 `a815666`。衝突在美術檢查點、交接、狀態與驗收文。手機圖示留在第 21 輪，雨記成第 22 輪。截圖腳本加上 `rain`，`phone` 與 `vista` 留著。大門仍是 `gate`。

`rainStreaks("high")` 是 320，`rainStreaks("low")` 是 64。只在 `wet` 且人在戶外時畫。減少動態時雨絲停住。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 260 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8110/?qa=1`。高畫質 1280×720、低畫質 1280×720、高畫質 390×780 都站在宮燈大道，雨後預設看得到雨絲，低畫質條數較少。三次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 雨跟著減少動態（本輪）

來源 `70fc091` 接到 `5e99473`。沒有衝突。雨改呼叫 `useReducedArtMotion`，不再只在掛上時讀一次 `matchMedia`。條數沒有改。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 261 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8111/?qa=1&q=high`，1280×720，宮燈大道、雨後預設。連續兩幀的差集看得到雨絲位移。打開減少動態之後，差集不再有雨絲，樹叢和待機還在動。`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 覺生綜合大樓（本輪）

來源 `d061102` 與後續 `e09a90f` 接到 `fb932d2`。衝突在美術檢查點、交接、狀態與驗收文。雨留在第 22 輪，覺生綜合大樓記成第 23 輪。截圖腳本加上 `integrated`，`rain` 與 `phone` 留著。大門仍是 `gate`。

`integrated` 的種類是 `linked-hall`。玻璃基座用整棟底面積，上層退縮。上層窗帶的 local z 跟 `linkedHallProfile`，不再用整棟的寬。名牌是「覺生綜合大樓」。精度仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 261 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8112/?qa=1&q=high`。1280×720 與 390×780 都看得到玻璃基座、退縮上層和名牌。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 守謙國際會議中心（本輪）

來源 `a8558b5` 接到 `4bd138f`。衝突在量體種類、窗帶、截圖腳本、測試，以及美術檢查點、交接、狀態與驗收文。覺生綜合大樓留在第 23 輪，會議中心記成第 24 輪。截圖腳本留下 `integrated`，加上 `forum`。大門仍是 `gate`。

`conference` 的種類是 `forum-hall`。低寬淺色量體、南向玻璃帶、出挑屋簷，共用窗帶跳過這種量體。行政大樓仍是 `study-block`。海事博物館仍是船型。名牌是「守謙國際會議中心」。精度仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 261 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8113/?qa=1&q=high`。1280×720 與 390×780 都看得到低寬量體、南向玻璃帶、出挑屋簷和名牌。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 司令臺（本輪）

來源 `1e077d1` 接到 `1ee26e6`。衝突在量體種類、窗帶、截圖腳本，以及美術檢查點、交接、狀態與驗收文。會議中心留在第 24 輪，司令臺記成第 25 輪。截圖腳本留下 `integrated` 與 `forum`，加上 `stand`。大門仍是 `gate`。

`reviewing` 的種類是 `stand`。低平台、後方小間、棚頂，共用窗帶跳過這種量體，也不畫實驗樓屋頂設備。主題仍是 `lab`，所以 id 覆寫要留在主題判斷前面。台面還不能走上去。名牌是「司令臺／達文西樂創基地」。精度仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 261 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8114/?qa=1&q=high`。1280×720 與 390×780 都看得到低平台、後方小間和棚頂。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 風洞廠房（本輪）

來源 `916a19e` 接到 `a07defc`。衝突在量體種類、窗帶、截圖腳本，以及美術檢查點、交接、狀態與驗收文。司令臺留在第 25 輪，風洞記成第 26 輪。截圖腳本留下 `integrated`、`forum` 與 `stand`，加上 `shed`。大門仍是 `gate`。

`wind-lab` 的種類是 `shed`。低長廠房、屋頂風管、一端進氣箱，共用窗帶跳過這種量體。主題仍是 `lab`，所以 id 覆寫要留在主題判斷前面。化學館仍是 `lab-block`。名牌是「風洞實驗室」。風管尺寸仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 261 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8115/?qa=1&q=high`。1280×720 與 390×780 都看得到低長廠房、屋頂風管和進氣箱。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 麗澤國際學舍（本輪）

來源 `add55fe` 接到 `24ffb9d`。衝突在量體種類、截圖腳本，以及美術檢查點、交接、狀態與驗收文。量體渲染沒有衝突，`intl-dorm` 加在宿舍量體前面。風洞留在第 26 輪，麗澤記成第 27 輪。截圖腳本留下 `integrated`、`forum`、`stand` 與 `shed`，加上 `reitaku`。大門仍是 `gate`。

`reitaku` 的種類是 `intl-dorm`。淺灰綠牆、底層玻璃門廳、平頂橫樑。主題仍是 `dorm`，所以 id 覆寫要留在主題判斷前面。松濤仍是 `dorm-block`。共用窗帶仍畫。名牌是「麗澤國際學舍」。精度仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 261 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8116/?qa=1&q=high`。1280×720 看得到淺灰綠牆、玻璃門廳、平頂橫樑和名牌。390×780 是同一棟的近景。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 傳播館（本輪）

來源 `ede6705` 接到 `f82692d`。衝突在量體種類、量體渲染、截圖腳本，以及美術檢查點、交接、狀態與驗收文。麗澤留在第 27 輪，傳播館記成第 28 輪。截圖腳本留下 `integrated`、`forum`、`stand`、`shed` 與 `reitaku`，加上 `media`。大門仍是 `gate`。

`business-o` 與 `business-q` 的種類是 `media-hall`。深色基座、淺色上層、屋頂天線。主題仍是 `arts`，所以 id 覆寫要留在主題判斷前面。文學館仍是 `hip-roof-block`。共用窗帶仍畫。名牌是「傳播館 O 館」。天線不是實測。精度仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 261 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8117/?qa=1&q=high`。1280×720 與 390×780 都看得到深色基座、淺色上層、屋頂天線和名牌。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 視聽教育館

來源 `8517cae` 接到 `3b4498a`。衝突在量體種類、量體渲染、截圖腳本，以及美術檢查點、交接、狀態與驗收文。傳播館留在第 28 輪，視聽教育館記成第 29 輪。截圖腳本留下既有場景，加上 `auditorium`。大門仍是 `gate`。

`audiovisual` 的種類是 `auditorium`。深色廳堂、屋頂一端舞台塔。主題仍是 `arts`，所以 id 覆寫要留在主題判斷前面。文學館仍是 `hip-roof-block`。共用窗帶仍畫。名牌是「視聽教育館」。舞台塔不是實測。精度仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 261 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8118/?qa=1&q=high`。1280×720 與 390×780 都看得到深色廳堂、舞台塔和名牌。兩次 `pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 巡禮折線

來源 `3c9cf1d` 接到 `9b74d14`。衝突只在美術檢查點、交接、狀態與驗收文。視聽教育館留在第 29 輪，這條折線記成第 30 輪。量體種類沒有改。

三條折線以半徑 0.42 m 走到宮燈教室、圖書館、體育館門口。中線從坡底走到坡頂，人留在護牆之間。折線從銅像與海豚基座東側過，體育館從宮燈教室南緣、活動中心與教育館之間過。精度仍是 estimated，階數沒有展開。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 263 通過。`npm run build:site` 通過。折線沒有畫在畫面上，所以沒有新的定步截圖。

瀏覽器 `http://127.0.0.1:8119/`。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 建築系館

來源 `55a42fb` 接到 `6128e70`。衝突在量體種類、量體渲染、截圖腳本、量體測試，以及美術文件。巡禮折線留在第 30 輪，建築系館記成第 31 輪。截圖腳本留下既有場景，加上 `studio`。化學館仍是 `lab-block`。

`architecture` 的種類是 `studio-block`。混凝土量體、南向玻璃、遮陽板、屋頂採光。主題仍是 `arts`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶。名牌是「建築系館」。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 263 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8120/?qa=1&q=high`。1280×720 看得到混凝土量體、南向玻璃、遮陽板、屋頂採光和名牌。390×780 是同一面的近景，這四樣仍在畫面裡。兩次 `pageErrors` 空。沒有綠瓦。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 學生活動中心

來源 `4bf084a` 接到 `7614963`。衝突在量體種類、量體函式、量體渲染、截圖腳本，以及美術文件。建築系館留在第 31 輪，學生活動中心記成第 32 輪。截圖腳本留下既有場景，加上 `activity`。覺軒仍是 `hip-roof-block`。

`commons` 的種類是 `activity-hall`。一層門廳、南向玻璃、遮陽板、退縮上層。主題仍是 `arts`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶。分區仍是 culture-58。名牌是「學生活動中心」。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 263 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8121/?qa=1&q=high`。1280×720 看得到門廳、南向玻璃、遮陽板、退縮上層和名牌。390×780 是同一面的近景，這四樣仍在畫面裡。兩次 `pageErrors` 空。沒有綠瓦。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 勤務監控管制中心（本輪）

來源 `8e6f1e6` 接到 `33bc106`。衝突在量體種類、量體函式、量體渲染、截圖腳本、量體測試，以及美術文件。學生活動中心留在第 32 輪，崗亭記成第 33 輪。截圖腳本留下既有場景，加上 `watch`。化學館仍是 `lab-block`。大門仍是 `gate`。

`security` 的種類是 `watch-post`。低崗亭、南向窗、屋頂天線。主題仍是 `lab`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶，也不畫實驗樓屋頂設備。名牌是「勤務監控管制中心」。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 263 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8122/?qa=1&q=high`。1280×720 看得到低崗亭、南向窗、屋頂天線和名牌。390×780 是同一面的近景，窗、天線和名牌仍在畫面裡。兩次 `pageErrors` 空。沒有實驗樓屋頂設備。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 工學大樓（本輪）

來源 `e0c5fee` 接到 `592b6a1`。衝突在量體種類、量體函式、量體渲染、截圖腳本、量體測試，以及美術文件。勤務監控留在第 33 輪，工學大樓記成第 34 輪。截圖腳本留下既有場景，加上 `engineering`。工學館與化學館仍是 `lab-block`。

`engineering` 的種類是 `eng-tower`。深色基座、退縮的淺色塔樓、兩條窗帶貼在退縮面上。主題仍是 `lab`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶，也不畫實驗樓屋頂設備。名牌是「工學大樓」。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 263 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8123/?qa=1&q=high`。1280×720 看得到深色基座、退縮塔樓、兩條窗帶、橫樑和名牌。390×780 是退縮牆面的近景，兩條窗帶、基座和名牌仍在畫面裡，橫樑在畫面頂緣。兩次 `pageErrors` 空。沒有實驗樓屋頂設備。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 路網中線（本輪）

來源 `15c555c` 接到 `26c82cf`。衝突在截圖腳本與美術文件。路的折點直接套上。工學大樓留在第 34 輪，這兩段路記成第 35 輪。截圖腳本留下既有場景，加上 `roads`。巡禮折線沒有改。

視聽教育館北牆外的中線改走 z=-25.6，範圍是 x 202 到 242。大忠警衛站的中線改從 x=486 的兩根門柱中間過。`scripts/campus-links.test.mjs` 以半徑 0.42 m 走完整條估計路網，沒有被實體卡住。位置仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 264 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8124/?qa=1&q=high`。1280×720 看得到館外的路，以及從兩根紅柱中間過的路。390×780 的館側是深色牆和樹的近景，路只在畫面底緣。390×780 的門仍看得到兩根門柱和從中間過的路。`pageErrors` 空。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 驚聲大樓（本輪）

來源 `27a50b0` 接到 `d1627c4`。衝突在量體種類、量體函式、量體渲染、截圖腳本、量體測試，以及美術文件。路網中線留在第 35 輪，驚聲大樓記成第 36 輪。截圖腳本留下既有場景，加上 `memorial`。文學館仍是 `hip-roof-block`。

`chingsheng-building` 的種類是 `memorial-tower`。深色基座、石色樓身、底層玻璃、三條橫帶、平頂壓簷。不畫共用窗帶，也沒有綠瓦。名牌是「驚聲大樓」。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 264 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8125/?qa=1&q=high`。1280×720 看得到深色基座、石色樓身、三條橫帶、平頂壓簷、底層玻璃和名牌。390×780 是同一面的近景，壓簷、橫帶、玻璃和名牌仍在畫面裡。兩次 `pageErrors` 空。沒有綠瓦。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 紹謨紀念體育館（本輪）

來源 `6530243` 接到 `357de45`。衝突在量體種類、量體函式、量體渲染、截圖腳本、量體測試，以及美術文件。驚聲大樓留在第 36 輪，體育館記成第 37 輪。截圖腳本留下既有場景，加上 `gym`。泳館仍是 `sport-hall`。司令臺仍是 `stand`。

`gymnasium` 的種類是 `arena`。淺色館身、深色台基、南向高側窗、出挑平頂。不畫共用窗帶。名牌是「紹謨紀念體育館」。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 264 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8126/?qa=1&q=high`。1280×720 看得到淺色館身、深色台基、南向高側窗、出挑平頂和名牌。390×780 是同一面的近景，出挑平頂、高側窗和名牌仍在畫面裡，台基多半被前景的樹擋住。兩次 `pageErrors` 空。泳館仍是綠灰運動館。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 騮先紀念科學館（本輪）

來源 `42980bb` 接到 `36b3112`。衝突在量體種類、量體函式、主題覆寫、量體渲染、截圖腳本、量體測試，以及美術文件。體育館留在第 37 輪，科學館記成第 38 輪。截圖腳本留下既有場景，加上 `science`。化學館仍是 `lab-block`。

`science` 的種類是 `science-hall`。淺色館身、東側直玻璃、壓簷。不畫共用窗帶，也沒有實驗樓屋頂設備。id 覆寫留在主題判斷前面。名牌是「騮先紀念科學館」。未匯出的舊剪影沒有畫進場景。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 264 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8127/?qa=1&q=high`。1280×720 看得到淺色館身、東側直玻璃、壓簷和名牌。390×780 是南面的近景，壓簷和名牌仍在畫面裡，東側玻璃在畫面右緣之外。兩次 `pageErrors` 空。化學館仍是實驗樓。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 背包淨空（本輪）

來源 `94e090f` 接到 `2189e5a`。衝突在量測測試與美術文件。科學館留在第 38 輪，背包記成第 39 輪。較早的骨原點提交 `dbf0bbe` 不在 `main`，這次直接採用蒙皮頂點的檢查。

每個動作片段取 17 個時間點，比較背包正面的蒙皮頂點和同一高度的外套背面。最靠近的是 run，間隙 22.0 mm。靜止也是 22.0 mm。背包骨轉 90 度會穿進 116.7 mm，測試會失敗。揹帶仍綁在胸口。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 265 通過。`npm run build:site` 通過。可玩的 `AdventureApp` 區塊與科學館那次相同。

瀏覽器 `http://127.0.0.1:8128/`。沒有新的定步截圖。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 工學館（本輪）

來源 `37cc7aa` 接到 `9068ea3`。衝突在量體種類、量體函式、主題覆寫、量體渲染、截圖腳本、量體測試，以及美術文件。背包淨空留在第 39 輪，工學館記成第 40 輪。截圖腳本留下既有場景，加上 `workshop`。化學館仍是 `lab-block`。工學大樓仍是 `eng-tower`。

`old-engineering` 的種類是 `workshop`。磚紅基座、淺色上層、南向玻璃、屋頂小間。主題仍是 `lab`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶，也沒有實驗樓屋頂設備。名牌是「工學館」。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 265 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8129/?qa=1&q=high`。1280×720 看得到磚紅基座、淺色上層、南向玻璃、屋頂小間和名牌。390×780 是南面的近景，基座、玻璃、名牌和屋頂小間仍在畫面裡。兩次 `pageErrors` 空。化學館仍是實驗樓。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 課程地圖標記（本輪）

來源 `267b413` 接到 `ca8e8b8`。衝突在美術文件。工學館留在第 40 輪，課程標記記成第 41 輪。截圖腳本留下既有場景，加上 `lesson`。小地圖仍只畫金圈。

展開的校園地圖在課程金圈上方寫兩個字。進行中的步驟是選系、移動、補給、普攻、技能。完成與沒有課程時不寫字。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 266 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8130/?qa=1&q=high`。課程設成移動、標記放在 (0, -80)，打開地圖。1280×720 與 390×780 的金圈上方都看得到「移動」。兩次 `pageErrors` 空。工學館仍是磚紅基座和屋頂小間。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 紹謨紀念游泳館（本輪）

來源 `615c426` 接到 `5e9dc40`。衝突在量體種類、主題覆寫、共用窗帶、量體渲染、量體測試，以及美術文件。課程標記留在第 41 輪，游泳館記成第 42 輪。截圖腳本留下既有場景，加上 `pool`。體育館仍是 `arena`。司令臺仍是 `stand`。化學館仍是 `lab-block`。

`swimming` 的種類是 `pool-hall`。深色基座、淺色長廳、南向高窗、屋頂長脊。主題仍是 `sport`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶。名牌是「紹謨紀念游泳館」。水道長度仍待測。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 266 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8131/?qa=1&q=high`。1280×720 看得到淺色長廳、南向高窗、屋頂長脊和名牌，深色基座在地面線上，一部分被前景的樹擋住。390×780 是屋頂和上層牆的近景，長脊和高窗仍在畫面裡，名牌只在右緣露出一角，基座在畫面下方之外。兩次 `pageErrors` 空。體育館仍是淺色館身。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 行政大樓（本輪）

來源 `15aff8c` 接到 `61ed00f`。衝突在量體種類、主題覆寫、共用窗帶、量體渲染、量體測試、截圖腳本，以及美術文件。游泳館留在第 42 輪，行政大樓記成第 43 輪。截圖腳本留下既有場景，加上 `office`。教育館、外語大樓與會文館仍是 `study-block`。化學館仍是 `lab-block`。舊的 admin-hall 不合併。

`administration` 的種類是 `office-block`。石色樓身、深色基座、南向入口玻璃、兩條窗帶。主題仍是 `study`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶。名牌是「行政大樓」。入口玻璃貼著南牆，入口寬度小於樓寬。入口位置仍待測。外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 266 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8132/?qa=1&q=high`。1280×720 看得到石色樓身、兩條窗帶、南向入口玻璃、壓簷和名牌，深色基座在地面線上。390×780 是南向近景，窗帶、入口玻璃、名牌和壓簷仍在畫面裡，基座只剩地面上的一條。兩次 `pageErrors` 空。游泳館仍是淺色長廳。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 實棟學人宿舍（本輪）

來源 `5c92b44` 接到 `800d43d`。衝突在量體種類、主題覆寫、共用窗帶、門廊函式、截圖腳本，以及美術文件。行政大樓留在第 43 輪，實棟學人宿舍記成第 44 輪。截圖腳本留下既有場景，加上 `faculty`。松濤一館到五館仍是 `dorm-block`。麗澤仍是 `intl-dorm`。

`faculty` 的種類是 `faculty-house`。淺色樓身、南向門廊、兩條窗帶。主題仍是 `dorm`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶，也沒有宿舍屋頂量體。名牌是「實棟學人宿舍」。門廊貼著南牆，寬度小於樓寬。門廊外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 266 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8133/?qa=1&q=high`。1280×720 看得到淺色樓身、兩條窗帶、南向門廊、門玻璃和名牌，沒有宿舍屋頂量體。390×780 是南向近景，窗帶、名牌和門廊仍在畫面裡，門玻璃只露出一角。兩次 `pageErrors` 空。行政大樓仍是石色樓身。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。第一次路線在戰鬥後遇到本機 I/O 錯誤，重跑通過。

## 濯纓苑／校史館（本輪）

來源 `3a2b5df` 與 `e478b9c` 接到 `65507cd`。衝突在量體種類、主題覆寫、共用窗帶、園舍函式、截圖腳本，以及美術文件。實棟學人宿舍留在第 44 輪，濯纓苑記成第 45 輪。截圖腳本留下既有場景，加上 `garden`。文學館與覺軒仍是 `hip-roof-block`。第二筆把白牆從基座頂接到坡頂底。

`yingyuan` 的種類是 `garden-house`。白牆、木色基座、收緊的綠瓦坡頂、南向迴廊。主題仍是 `arts`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶。名牌是「濯纓苑／校史館」。迴廊貼著南牆。坡頂比學術樓的錐頂收得更緊。迴廊與坡頂外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 266 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8134/?qa=1&q=high`。1280×720 看得到白牆、木色基座、綠瓦坡頂、南向迴廊和名牌，坡頂比牆面收得更緊。390×780 是近景，基座、白牆、坡頂和迴廊仍在畫面裡，名牌露出一角。兩次 `pageErrors` 空。實棟學人宿舍仍是淺色樓身。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 外國語文大樓（本輪）

來源 `d5a28c8` 接到 `1565a74`。衝突在量體種類、主題覆寫、共用窗帶、量體渲染、量體測試、截圖腳本，以及美術文件。濯纓苑留在第 45 輪，外國語文大樓記成第 46 輪。截圖腳本留下既有場景，加上 `language`。教育館與會文館仍是 `study-block`。舊的 foreign-lang-hall 不合併。

`foreign` 的種類是 `language-hall`。暖色底層、南向長廊玻璃、退縮的淺色上層、兩條窗帶。主題仍是 `study`，所以 id 覆寫要留在主題判斷前面。不畫共用窗帶。名牌是「外國語文大樓」。長廊玻璃貼著南牆，上層窗帶貼著退縮的牆。長廊外形仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 266 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8135/?qa=1&q=high`。1280×720 看得到暖色底層、南向長廊玻璃、退縮的淺色上層、兩條窗帶和名牌。390×780 是南向近景，窗帶、名牌、長廊玻璃和底層仍在畫面裡。兩次 `pageErrors` 空。濯纓苑仍是白牆園舍。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 植栽距離（本輪）

來源 `4dc3786` 接到 `4b88b77`。衝突在美術文件和截圖腳本。植栽渲染與新的距離函式自動接上。外國語文大樓留在第 46 輪，植栽記成第 47 輪。截圖腳本留下既有場景，加上 `planting`。

樹木與灌木在高畫質 48 m 內用模型，外面改便宜樹冠。杜鵑、花圃、地被和青苔超出距離就不畫。棕櫚超出距離留便宜樹冠。正好 48 m 算遠景。省電畫質仍走 `simpleTrees`。植株位置仍是 estimated。沒有新的獎勵帳，扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 267 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8136/?qa=1&q=high`。1280×720 在宮燈大道近處看得到圓灌木、粉紅花圃和館後的樹。390×780 是同一站的近景，灌木、花圃和一棵樹仍在畫面裡。兩次 `pageErrors` 空。外國語文大樓仍是暖色底層。同一站跨系統路線再次通過：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 學期（本輪）

來源 `90768e4` 與 `9c45f10` 接到 `5d07892`。程式自動接上，沒有衝突。文件只留在 `docs/integration/`，沒有帶入另一套 `docs/full-integration/`。

學期只看既有 `claimed`。大門任務和補給委託都領取後是期中，再加上戰鬥任務 `first` 才是期末。委託付經驗 12、筆記 2，只進既有背包，而且只記一次。兩份科系清冊都留著。`MAIN_INTEGRATION` 仍是 false。扣血仍走既有 `attack()`。`npm run typecheck` 通過。`npm test` 270 通過。`npm run build:site` 通過。

瀏覽器 `http://127.0.0.1:8137/`。1280×720 狀態卡寫著「期中 · 擊退三隻異象」，通知寫著這次補給只記一次。390×780 狀態卡仍在，頁面讀到同一句。`pageErrors` 空。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；revision 1；第二客戶端看到期中；`revision_conflict`；斷線佇列 `cloudXp` 47；登出 401。`pageErrors` 空。

## 肩肘膝（本輪）

來源 `6ac2cf3` 接到 `c192152`。衝突在美術文件。測試自動接上。植栽留在第 47 輪，肩肘膝記成第 48 輪。

每個動作片段取 17 個時間點。這台量到膝 94 度、肘 97 度、肩前舉 166 度。膝往後折、肘往反方向折、肩再多舉，測試會失敗。沒有改角色網格。`npm run typecheck` 通過。`npm test` 271 通過。`npm run build:site` 通過，產物 `AdventureApp-BEQkjSOj.js` 與學期那一版相同。遊戲程式沒變，沒有重跑跨系統路線，也沒有新的畫面。

## 鍾靈化學館（本輪）

來源 `eee5c91` 接到 `468a516`。衝突在量體分派、繪製和美術文件。行政大樓仍是 `office-block`。會文館仍是教學樓。肩肘膝留在第 48 輪，化學館記成第 49 輪。

鍾靈化學館是深色基座、淺色館身、南向玻璃和屋頂排氣箱。名牌寫著鍾靈化學館。沒有共用窗帶。排氣箱留在屋頂範圍內。科學館仍是東側直玻璃，工學館仍是磚紅基座，工學大樓仍是退縮塔樓。精度仍是 estimated。`npm run typecheck` 通過。`npm test` 271 通過。`npm run build:site` 通過，產物 `AdventureApp-CdR7Qu81.js`。

瀏覽器 `http://127.0.0.1:8138/`。1280×720 定步白天，名牌寫著鍾靈化學館，屋頂看得到排氣箱，頁面無錯誤。390×780 同一棟仍看得到南向玻璃和排氣箱。`pageErrors` 空。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線佇列 `cloudXp` 47；登出 401。`pageErrors` 空。第一次路線在戰鬥截圖之後被瀏覽器關閉錯誤打斷，同一站重跑通過。

## 裝備與製作（本輪）

來源 `7ffdd01`、`0267087`、`21c0ad7`、`edd3a72`、`11ddebac` 接到 `e1f52fd`。衝突只在 `store.ts` 的放置與補給，以及 QA 型別的註解。新建與移動都仍結算一次學期委託。採集鉤的額外筆記和委託筆記加在同一只背包。補給站不再擋住自己的互動。隔離的裝備在下一次存檔還在。裝上的扳手可以從提示或背包修復。

主工具、配件、背包各一槽。格子仍是 24。徽章仍走原來的裝備。材料不夠就不扣。`npm run typecheck` 通過。`npm test` 281 通過。`npm run build:site` 通過，產物 `AdventureApp-C61M5IZU.js`。

瀏覽器 `http://127.0.0.1:8139/`。1280×720 與 390×780 打開背包，都寫著 4/24 格、負重 80，三個槽是空的。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線佇列 `cloudXp` 47；登出 401。`pageErrors` 空。

## 校園遭遇（本輪）

來源 `6ac14a2`、`d82bf00`、`7a71553`、`7b9bd86`、`4d81bf1`、`61f6e6a` 接到 `afb6cbd`。衝突在畫面的 import。裝備、學期與背包都留著。進度用既有存檔的 `variety` 欄。新戰鬥離開既有敵人出生點。

走到估計錨點會出現遭遇。1280×720 在 (0, -40) 打開宮燈夜巡，寫著先對線索，然後可以護送筆記或留下處理異象。390×780 看得到「宮燈夜巡」。位置仍是 estimated。`npm run typecheck` 通過。`npm test` 296 通過。`npm run build:site` 通過，產物 `AdventureApp-DIpCPHRg.js`。

瀏覽器 `http://127.0.0.1:8140/`。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線佇列 `cloudXp` 47；登出 401。`pageErrors` 空。

## 遭遇寫入失敗（本輪）

來源 `a2bb964` 與 `94c0b8a` 接到 `d8d6d90`。`store.ts` 自動接上。裝備、學期與背包都留著。

把 `tamkang-gameplay-variety-v1` 的 `setItem` 改成丟出例外後再匯入，`importSave` 回傳 true，沒有丟出例外，原鍵的完成紀錄留著，`saved` 是 `error`。拿掉 `variety` 欄再匯入，完成紀錄清成空陣列，`saved` 回到 `saved`。`npm run typecheck` 通過。`npm test` 296 通過。`npm run build:site` 通過，產物 `AdventureApp-DLaW6zbU.js`。這輪沒有新的畫面。

瀏覽器 `http://127.0.0.1:8141/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 51，因為這次 +7 的那一端先寫上（+3 的那一端會是 47），離線加的 1 點沒有寫上去；登出 401。`pageErrors` 空。

## 教師故事（本輪）

來源 `b2a711a`、`7f6f3c8`、`f241aef`、`1b51027`、`e9b8c40`、`246eadf` 接到 `dca0984`。衝突只在對話框的關閉與捲動 id。敘事面板用 `narrative-close` 與 `narrative-scroll`。遭遇面板仍不走一般面板的關閉計畫。裝備、學期、背包和遭遇寫入狀態都留著。

十二名都是虛構角色。崗位是門口外推的估計位置。顧衡在建築系館南側。1280×720 打開三個選項。選「我先補剖面」後經驗 12→34，`claimed` 有 `quest-faculty-gu-meet` 與 `quest-faculty-studio-meet`。重載後經驗仍是 34，句子換成裂縫還在。390×780 對話可以捲動，捲到底看得到「離開，不結算」，關閉鈕 44×44。`MAIN_INTEGRATION` 仍是 false。`npm run typecheck` 通過。`npm test` 305 通過。`npm run build:site` 通過，產物 `AdventureApp-BJuLvNHy.js`。

瀏覽器 `http://127.0.0.1:8142/`。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 路燈淨空（本輪）

來源 `e092064` 接到 `f5ac653`。程式自動接上。美術文件留到第 49 輪，這一輪記成第 50 輪。

路燈中心若落在實體裡，會沿最近的一面推到牆外 1.2 m。商管大樓那盞 z 大於 -171，海事博物館那盞 z 大於 -242。圖書館名牌朝南，z 在南牆外側。位置仍是 estimated。`npm run typecheck` 通過。`npm test` 306 通過。`npm run build:site` 通過，產物 `AdventureApp-CBoDD94C.js`。

瀏覽器 `http://127.0.0.1:8143/`。1280×720 與 390×780 看得到商管大樓南牆外的路燈站在草地上。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

PR #122 `571779` 沒有第二個顧衡。那條分支的遊戲程式比現在的 `main` 舊，不要單獨合併。

## 圖書館坡道（本輪）

來源 `80569af`、`75128e0` 接到 `54dfe86`。衝突在美術文件、截圖腳本和道具匯入。路燈淨空留著：名牌仍朝南、貼在南牆外側，路燈仍被推到牆外。坡道記成美術第 51 輪。

坡道北端高出南端 1.05 m，停在南牆外 0.4 m 以內。南端貼地。坡道外側 0.5 m 裙邊收到地面。網格頂點用走路高度，坡端和裙邊中點的網格與腳底相差小於 2 cm。人站在坡面上。定步白天量到北端地面 20.74、南端 19.51、坡外 19.59。坡度仍是 estimated。`npm run typecheck` 通過。`npm test` 307 通過。`npm run build:site` 通過，產物 `AdventureApp-BLw17Z0-.js`。

瀏覽器 `http://127.0.0.1:8144/`。1280×720 與 390×780 都看得到人站在圖書館前的坡上。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

PR #122 的 head 在這輪又改到 `48b1ac6`。和 `main` 比，遊戲程式沒有新的期末規則，三隻異象的說法只寫在他們的路線腳本和 `docs/full-integration`。這一輪只把雲端契約對裝備欄的檢查接進來。

## 雲端裝備契約（本輪）

來源 `a76918e` 的 `src/features/cloud-save/contract.ts` 接到 `a91b3bd`。沒有帶 `docs/full-integration`、他們的路線腳本，也沒有改 `.ad-interact` 的位置。沈酌沒有新句子時的提示已經在主遊戲裡。

雲端存檔接受 `loadout`、`gear`、`quarantine`、`quarantineGear` 和 `heldBuild`。裝備欄多一個 `bonus` 欄會以 `unsafe_content` 拒絕。品質不在 plain／fine、裝備實例超過 24、隔離數量是 0、手持設施沒有耐久，都會拒絕。沒有這些欄位的舊存檔仍通過。`npm run typecheck` 通過。`npm test` 309 通過。`npm run build:site` 產物仍是 `AdventureApp-BLw17Z0-.js`。

跨系統路線仍走 `http://127.0.0.1:8144/`，雲端伺服器用的是這份契約。通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。帶著裝備欄的本機存檔上傳成功。

## 球場不種樹（本輪）

來源 `5739cd3` 接到 `d32e714`。它不讀 PR #135 的球場線，只看既有的球場、田徑場和停車場範圍。美術文件留到第 51 輪，這一輪記成第 52 輪。

散佈的樹若落在這些場地裡面，或外緣 3 m 內，就不種。密度 1 時五虎崗外緣 2.9 m 內也沒有樹。植株位置仍是 estimated。`npm run typecheck` 通過。`npm test` 310 通過。`npm run build:site` 通過，產物 `AdventureApp-D2eWEjyb.js`。

瀏覽器 `http://127.0.0.1:8146/`。1280×720 與 390×780 都看得到五虎崗空草皮，樹在場外。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 雨後場地（本輪）

來源 `41771bb` 接到 `7c85a42`。美術文件留到第 52 輪，這一輪記成第 53 輪。沒有帶 PR #135 的球場線。

沒有貼圖的球場、停車場和跑道在雨後把顏色乘小，亮度下降、粗糙度下降。晴天顏色不變。這些顏色比材質庫的濕灰還深，所以不把灰色混進去。不是實測日照。樹仍留在場外。`npm run typecheck` 通過。`npm test` 311 通過。`npm run build:site` 通過，產物 `AdventureApp-Bw3-LFcW.js`。

瀏覽器 `http://127.0.0.1:8147/`。1280×720 與 390×780 都看得到五虎崗：晴天草皮較淺，雨後較深，畫面有雨絲。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 綜合球場標線（本輪）

來源 `06a75dc` 接到 `9dd707e`。美術文件留到第 53 輪，這一輪記成第 54 輪。雨後的顏色留在同一支結構檔上。

五虎崗綜合球場是兩塊有邊線、中線和球網的場。排球場有一圈邊線。每條線都在草皮裡面。田徑場和停車場沒有這些線。標線尺寸仍是 estimated。樹仍留在場外。`npm run typecheck` 通過。`npm test` 312 通過。`npm run build:site` 通過，產物 `AdventureApp-DCYaPlp2.js`。

瀏覽器 `http://127.0.0.1:8148/`。1280×720 與 390×780 都看得到兩塊白線場。雨後草皮較深，標線還在。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 覺軒花園（本輪）

來源 `193f29d` 接到 `ebf0cde`。美術文件留到第 54 輪，這一輪記成第 55 輪。球場標線和雨後顏色留著。散佈的樹仍避開球場。

覺軒花園是四根角柱和綠瓦頂，中間可以走，碰撞只在柱子。另一筆覺軒仍是坡頂。亭子周圍 6 m 不種散佈的樹。外形仍是 estimated。`npm run typecheck` 通過。`npm test` 313 通過。`npm run build:site` 通過，產物 `AdventureApp-DzP7Xkfy.js`。

瀏覽器 `http://127.0.0.1:8149/`。1280×720 看得到綠瓦頂、紅柱和鋪面。390×780 看得到瓦頂和鋪面。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 小地圖課程字（本輪）

來源 `9f89d1c` 接到 `57fc468`。美術文件留到第 55 輪，這一輪記成第 56 輪。

課程進行時，小地圖左下角寫兩個字。展開地圖仍把同樣的字寫在金圈上方。窄視窗的課程條改到小地圖下方，系名不再被蓋住。`npm run typecheck` 通過。`npm test` 313 通過。`npm run build:site` 通過，產物 `AdventureApp-BM0-cuW7.js`。

瀏覽器 `http://127.0.0.1:8150/`。1280×720 與 390×780 的小地圖都寫著「移動」，系名「土木工程學系」完整。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 室內繼續

來源 `e2d26ff` 接到 `53ec394`。只取遊戲程式和執行期測試。沒有帶進 `docs/full-integration`，也沒有改跨系統路線腳本。

繼續學期會先匯入存檔，匯入會清掉房間並重寫檔案。活著再繼續時，用玩家剛確認的那份檔，回到公共建築的室內和樓層，並把房間寫回存檔。被擊倒再繼續，站在門口，房間清空。標題畫面在開始遊玩前仍畫校園。`npm run typecheck` 通過。`npm test` 314 通過。`npm run build:site` 通過，產物 `AdventureApp-CsOGkfs-.js`。

瀏覽器 `http://127.0.0.1:8151/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 坡道欄杆

來源 `1dce114` 接到 `4793fde`。美術文件留到第 56 輪，這一輪記成第 57 輪。欄杆放在現在的坡道兩側，不回到舊的南牆座標。坡道網格留著。

圖書館坡道左右各一道同長欄杆，離中線 0.95 m，立柱含兩端。克難坡沒有欄杆。`npm run typecheck` 通過。`npm test` 315 通過。`npm run build:site` 通過，產物 `AdventureApp-Cl3Ho6pe.js`。

瀏覽器 `http://127.0.0.1:8152/`。1280×720 與 390×780 都看得到兩側橫桿和立柱。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。第一次瀏覽器關閉時出現 EIO，同一站重跑通過。

## 校園快照雲端（本輪）

來源 `7182c6e` 接到 `83fa529`。只取雲端契約、上傳客戶端和後端文件。靜態產物沒有改，仍是 `AdventureApp-Cl3Ho6pe.js`。雲端伺服器讀的是這份新契約，所以仍跑跨系統路線。

雲端驗證接受敘事、多樣玩法、掉落、位置、室內和樓層。頂層白名單以外的欄位會被拒。沒有這些欄位的舊存檔仍可上傳。裝備欄位檢查留著。已有雲端版本時，後續上傳沿用該 revision。離線佇列留在原帳號，登入或重新載入後再送。已有上一份雲端版本時，可以把它寫回本機。`npm run typecheck` 通過。`npm test` 321 通過，含校園室內經上傳、下載和資料庫重開仍在。

瀏覽器 `http://127.0.0.1:8153/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 收集委託（本輪）

來源 `4628005` 接到 `e95c137`。補給結算留著裝備加成和學期委託，收集進度只記實際收下的補給，不記委託發的筆記。雲端白名單補上 `gathered` 和 `felled`。

學期委託新增四件：課堂筆記 12、零件 12、冰咖啡或烏龍茶合計 4、分組報告 2。筆記、零件和提神花掉以後進度不倒扣。小考不計入分組報告。十處巡邏離門口、教授和既有遭遇一段距離。`npm run typecheck` 通過。`npm test` 324 通過。`npm run build:site` 通過，產物 `AdventureApp-YMSPf-td.js`。

瀏覽器 `http://127.0.0.1:8154/?qa=1`。1280×720 的正門巡邏看得到突襲小考。學期委託寫著「還沒做完的會留在這裡」，收下補給後筆記是 4/12、零件是 2/12。頁面無錯誤。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。窄視窗的委託截圖沒有完成：角色選擇後 20 秒內沒有進入遊玩。

## 指定雲端版本（本輪）

來源 `82822a6`、`d992582`、`1c51c42` 接到 `b579dff`。靜態產物沒有改，仍是 `AdventureApp-YMSPf-td.js`。分類規則改了，所以仍跑跨系統路線。

已登入的帳號可以列出自己最多 8 筆雲端版本編號，並指定其中一筆寫回本機。恢復已刪版本不改本機，也不記獎勵。別的帳號的歷史留在原處。舊版 RPG 檔被拒為 `legacy_rpg`，留在本機，不寫入巡禮表。`npm run typecheck` 通過。`npm test` 327 通過。

瀏覽器 `http://127.0.0.1:8155/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。雲端面板不在靜態頁，版本列表由測試覆蓋。

## 收集進度重開（本輪）

來源 `4cdd8d7`、`a9afa5c` 接到 `f46fe06`。只取測試和後端筆記。遊戲程式與雲端分類都沒有改，靜態產物仍是 `AdventureApp-YMSPf-td.js`，所以沒有重跑跨系統路線。

圖書館存檔的收集進度跟樓層一起經過上傳、下載和程序重開。沒有這兩個欄位的舊存檔仍可通過驗證。程序重開後，筆記計數、分組報告計數、已領委託和版本 1、2 還在。同一個收集回執用新的 requestId 重送不會再次記帳。`npm run typecheck` 通過。`npm test` 328 通過。

## 獎勵只記一次（本輪）

來源 `ebb8513`、`0106bb5` 接到 `997ff0d`。靜態產物沒有改，仍是 `AdventureApp-YMSPf-td.js`。路線腳本直接讀雲端客戶端，登入會呼叫改過的 `bindAccount`，所以仍跑跨系統路線。

裝置先記住事件再發獎勵。登入只把回執抄到目前帳號。伺服器已記過的回執不再發。連不上伺服器時仍先發一次，回執留在該帳號佇列。`npm run typecheck` 通過。`npm test` 330 通過。

瀏覽器 `http://127.0.0.1:8156/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 帳號對不上就停住（本輪）

來源 `9c6c744` 接到 `4fb1fa4`。靜態產物沒有改，仍是 `AdventureApp-YMSPf-td.js`。路線腳本直接讀雲端客戶端，所以仍跑跨系統路線。

登入工作階段和裝置記的帳號不同時，上傳、下載、恢復和發獎勵都不進行，原來的佇列留著。回到該帳號後，佇列才送出。`npm run typecheck` 通過。`npm test` 331 通過。

瀏覽器 `http://127.0.0.1:8157/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 雲端校驗與最新離線上傳（本輪）

來源 `b080a9e`、`5ffb8fc` 接到 `11e350c`。靜態產物沒有改，仍是 `AdventureApp-YMSPf-td.js`。路線腳本直接讀雲端客戶端，所以仍跑跨系統路線。

未知欄位或內容校驗不符的雲端存檔不會寫進本機。連不上伺服器時，後一次上傳取代同一帳號較早的上傳，獎勵回執仍留在佇列。`npm run typecheck` 通過。`npm test` 333 通過。

瀏覽器 `http://127.0.0.1:8158/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 下載後先問（本輪）

來源 `bb86c66` 的行為接到 `2f68934`。沒有帶進那次把 `store.ts` 和 `AdventureHud.tsx` 整份重排的差異。靜態產物沒有改，仍是 `AdventureApp-YMSPf-td.js`。存檔程式有改，所以仍跑跨系統路線。

下載或恢復寫入本機後，自動存檔不會蓋掉這份，玩家用既有的存檔選擇決定要不要改用。`npm run typecheck` 通過。`npm test` 334 通過。

瀏覽器 `http://127.0.0.1:8159/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 雲端存檔回到室內，並清掉未送出的上傳（本輪）

來源 `0781e84`、`936ad5b` 的行為接到 `38b6f9f`。靜態產物改成 `AdventureApp-Crx82lpu.js`。雲端客戶端也有改，所以仍跑跨系統路線。

生命值大於 0 時，改用下載的存檔會回到該檔的公共室內樓層。成功下載或恢復後，這個帳號尚未送出的存檔上傳會拿掉，獎勵回執留著。`npm run typecheck` 通過。`npm test` 337 通過。

瀏覽器 `http://127.0.0.1:8160/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

## 許回與地上的委託獎勵（本輪）

來源 `c5c489b`、`e8b97ca` 接到 `f317ceb`。`store.ts` 衝突只在委託結算：保留學期戳記，並把放不下的獎勵標成地上的委託物品。靜態產物改成 `AdventureApp-Dnl7wjlJ.js`。

許回站在圖書館外。兩種歸因都能玩完，之後的話會引用玩家選過的說法。獎勵各付一次。事件不寫學期。地上的委託或對話獎勵撿起來不增加 `gathered`。`npm run typecheck` 通過。`npm test` 340 通過。

瀏覽器 `http://127.0.0.1:8161/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。

同一站把玩家送到許回面前。建築學系、第一週。交談後經驗 0→18→26→36，`gathered` 維持 0。談完再靠近，通知是「這位現在沒有新的話說。上一件事還沒完成，或這段已經談完。」手機 390×780 的關閉鈕是 44×44。幀時間是 SwiftShader。

## 離線上傳的第一次送出（本輪）

來源 `1f6d733`、`fdc0228`、`7644d81` 接到 `1c8f11e`。後端檢查點的時間衝突只留較新的那份紀錄。靜態產物仍是 `AdventureApp-Dnl7wjlJ.js`。

離線上傳第一次送出時改用目前的本機存檔，請求編號不變。送出只拿掉已完成的項目。途中新來的回執留著。已被拿掉的上傳若仍送到，而且沒有更新的上傳在等，會把玩家選的本機存檔寫回。`npm run typecheck` 通過。`npm test` 344 通過。

瀏覽器 `http://127.0.0.1:8162/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 失敗上傳的重試與地上委託標記（本輪）

來源 `95c5886`、`624ff44` 接到 `2ec9059`。後端檢查點只在紀錄的基底提交上有衝突，留下較新的 `1c8f11e`。靜態產物仍是 `AdventureApp-Dnl7wjlJ.js`。

失敗的離線上傳重試時用最新的本機存檔和新的請求編號。雲端仍是這台裝置上次寫入時才接下去。地上的 `quest` 標記可以進雲端存檔，數量不能超過那一堆。`npm run typecheck` 通過。`npm test` 348 通過。

瀏覽器 `http://127.0.0.1:8163/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 接續上傳被拿掉（本輪）

來源 `bfbf341` 接到 `5deed92`。靜態產物仍是 `AdventureApp-Dnl7wjlJ.js`。

從這台裝置自己的版本接下去的上傳，如果送出途中被拿掉，會把玩家留下的本機存檔寫回。斷線不再把那筆排回佇列。`npm run typecheck` 通過。`npm test` 349 通過。

第一次路線在存檔重載的截圖關閉時遇到 `EIO`，步驟只記到戰鬥。同一站重跑通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 斷線後保持拿掉，委託標記在重啟後還在（本輪）

來源 `dd6263a`、`c04dd7b` 接到 `90fa4f8`。靜態產物仍是 `AdventureApp-Dnl7wjlJ.js`。

已被拿掉的上傳在送出斷線後仍保持拿掉。伺服器若已收下同一份內容，會把玩家留下的本機存檔寫回。`scripts/cloud-save-flow.mjs` 通過：圖書館三樓、地上委託標記和內容校驗在程序重啟後還在，恢復較早版本時收集數量回到那一版，標記仍在。`npm run typecheck` 通過。`npm test` 351 通過。

瀏覽器 `http://127.0.0.1:8165/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 坡道欄杆的碰撞（本輪）

來源 `002453c` 接到 `b745f27`。靜態產物改成 `AdventureApp-B0KWHzwD.js`。

圖書館坡道兩側各有一道 0.12 m 厚的碰撞。0.42 m 的身體站上欄杆會被推開。坡面中心和南端入口仍停在原位。克難坡仍不設欄杆。`npm run typecheck` 通過。`npm test` 351 通過，其中「the library ramp has a railing on each side」包含這三項。

瀏覽器 `http://127.0.0.1:8166/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 帳號在送出途中換掉（本輪）

來源 `7d115d0` 接到 `269020c`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T05:25:20Z` 和帳號複核那一項。靜態產物仍是 `AdventureApp-B0KWHzwD.js`。

送出佇列時，每一筆之前再對一次目前登入的帳號。前一筆獎勵送出後帳號換了，下一筆上傳不再送，佇列留在原帳號。雲端讀到的存檔在寫入本機前再對一次帳號，另一個帳號的經驗不會蓋掉本機。`npm run typecheck` 通過。`npm test` 353 通過，其中「flush does not send the next upload after the session changes account」和「a session change is not given the other account's cloud save」涵蓋這兩項。

瀏覽器 `http://127.0.0.1:8167/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 登入確認後再問一次失敗（本輪）

來源 `0b254d5` 接到 `327520d`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T05:32:04Z` 和登入閃斷那一項。靜態產物仍是 `AdventureApp-B0KWHzwD.js`。

帳號已經確認之後，再問一次登入如果失敗，仍先問伺服器這件獎勵記過沒有。伺服器回答已記過時不發，也不再排進佇列。第一次就連不上時，仍先發一次，回執留在該帳號佇列。`npm run typecheck` 通過。`npm test` 354 通過，其中「a session blip does not grant a reward the server already recorded」涵蓋這項。

瀏覽器 `http://127.0.0.1:8168/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 登入閃斷仍寫回本機存檔（本輪）

來源 `26afab8` 接到 `7570724`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T05:35:42Z` 和寫回那一項。靜態產物仍是 `AdventureApp-B0KWHzwD.js`。

已被拿掉的上傳若已經送到伺服器，再問登入只是連不上時，仍把玩家留下的本機存檔寫回。帳號已經換成別人時不寫，只記下看到的版本。`npm run typecheck` 通過。`npm test` 355 通過，其中「a session blip still writes back the chosen file after a dropped upload lands」涵蓋這項。

瀏覽器 `http://127.0.0.1:8169/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 補給站冷卻跟著存檔走（本輪）

來源 `159e09f` 接到 `32a15ad`。存檔還原和後端檢查點有衝突。還原留下這次的 `facility:` 冷卻，學期戳記仍在。檢查點留下較新的 `2026-11-12T05:41:13Z` 和冷卻那一項。靜態產物改成 `AdventureApp-wsEEgaCK.js`。

建成的補給站若冷卻還在 180 秒內，匯入和雲端重載會把它留下。編號長度 1 到 80。已過期或超過 180 秒的時間丟掉。地上補給點仍用同一個窗口。`npm run typecheck` 通過。`npm test` 356 通過，其中「reloading a cloud save keeps a built station's harvest cooldown」和匯入測試涵蓋這項。

瀏覽器 `http://127.0.0.1:8170/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 指定版本恢復再對一次帳號（本輪）

來源 `0dac69d` 接到 `987c5a7`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T05:47:56Z` 和恢復確認那一項。靜態產物仍是 `AdventureApp-wsEEgaCK.js`。

指定版本恢復通過白名單和校驗之後，寫入本機前再對一次帳號。帳號換了或這次確認連不上，本機存檔維持原樣。`npm run typecheck` 通過。`npm test` 358 通過，其中「a session change does not apply a restored cloud save」和「a session blip does not apply a restored cloud save」涵蓋這兩項。

瀏覽器 `http://127.0.0.1:8171/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 上傳回應再對一次帳號（本輪）

來源 `7291692`、`7b6bcbf` 接到 `85ecd5d`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T05:55:36Z` 和兩次上傳確認。靜態產物仍是 `AdventureApp-wsEEgaCK.js`。

上傳成功的回應在記下版本之前再對一次帳號。帳號換了或這次確認連不上，這筆上傳留在原帳號佇列，不把那個版本記成這台裝置的寫入。接續上傳也一樣。`npm run typecheck` 通過。`npm test` 363 通過，其中「a queued upload stays when its response arrives for another account」、「an upload is not recorded when the session changes before its response is accepted」、「a session blip does not retire a queued upload」、「a continued upload stays queued when its response arrives for another account」和「a session blip does not record a continued upload」涵蓋這項。

瀏覽器 `http://127.0.0.1:8172/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 別的帳號的版本衝突留在佇列（本輪）

來源 `a8406d3` 接到 `4f300a7`。後端檢查點自動合併，留下較新的 `2026-11-12T05:58:41Z` 和版本衝突那一項。靜態產物仍是 `AdventureApp-wsEEgaCK.js`。

收到 409 或 422 時，採用另一台裝置的存檔或丟掉這筆上傳之前，再對一次帳號。帳號換了或這次確認連不上，這筆上傳留在原帳號佇列，也不把另一個帳號的存檔拿來選擇。同一個帳號、另一台裝置的版本衝突仍會丟掉這筆並提供選擇。直接上傳也一樣：換帳號就回 `account_mismatch`，確認連不上就改成已排入佇列。`npm run typecheck` 通過。`npm test` 366 通過，其中「a revision conflict from another account does not drop the queued upload」、「a revision conflict from another account is not offered as this save」和「a session blip does not drop a queued upload on revision conflict」涵蓋這項。

瀏覽器 `http://127.0.0.1:8173/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 指定版本恢復的版本衝突再對一次帳號（本輪）

來源 `10716ae` 接到 `7611148`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T06:02:37Z` 和恢復衝突那一項。靜態產物仍是 `AdventureApp-wsEEgaCK.js`。

指定版本恢復若收到版本衝突，在把那份存檔拿來選擇之前再對一次帳號。帳號換了就不提供選擇，確認連不上就維持本機。同一個帳號的衝突仍會提供選擇。`npm run typecheck` 通過。`npm test` 369 通過，其中「a revision conflict from another account is not offered as a restored save」、「a session blip does not offer a restored revision conflict」和「a same-account restore conflict still offers that cloud save」涵蓋這項。

瀏覽器 `http://127.0.0.1:8174/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 斷線上傳的後續讀取再對一次帳號（本輪）

來源 `a899394` 接到 `3530de8`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T06:06:24Z` 和後續讀取那一項。靜態產物仍是 `AdventureApp-wsEEgaCK.js`。

已被拿掉的上傳若讀到同一份內容，在記下版本或寫回本機之前再對一次帳號。這時帳號換成別人，不記下那個版本，也不寫回。確認連不上時，仍把玩家留下的本機存檔寫回。`npm run typecheck` 通過。`npm test` 370 通過，其中「a dropped upload is not recorded when the landed read belongs to another account」涵蓋這項。

瀏覽器 `http://127.0.0.1:8175/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 雲端驗證接受整座校園的採集冷卻（本輪）

來源 `42a7b3f` 接到 `bd69066`。後端檢查點自動合併，留下較新的 `2026-11-12T06:09:07Z` 和採集上限那一項。靜態產物仍是 `AdventureApp-wsEEgaCK.js`。

雲端驗證的採集時間最多 112 筆，含每個地上補給點和 48 座建成補給站。`facility:` 後面的編號長度 1 到 80。超過 112 筆、編號更長、或鍵名不安全就拒絕。匯入和重載仍只留下 180 秒內的冷卻。`npm run typecheck` 通過。`npm test` 371 通過，其中「a full campus of harvest cooldowns still passes the cloud contract」涵蓋這項。

瀏覽器 `http://127.0.0.1:8176/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 獎勵回執的回應再對一次帳號（本輪）

來源 `089b9d8` 接到 `ca2f289`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T06:12:39Z` 和獎勵回執那一項。靜態產物仍是 `AdventureApp-wsEEgaCK.js`。

獎勵回執的回應在記下或發放之前再對一次帳號。帳號換了或這次確認連不上，這件事維持未結，這個帳號可以再問。確認過且伺服器說已記過，仍不發。`npm run typecheck` 通過。`npm test` 374 通過，其中「another account's reward receipt does not decide this grant」、「another account's applied reward is not granted on this device」和「a session blip does not settle a reward receipt」涵蓋這項。

瀏覽器 `http://127.0.0.1:8177/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；`revision_conflict`；斷線時雲端經驗是 47；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 消失的直接上傳改接較新的本機檔（本輪）

來源 `df0b23c` 接到 `e878f26`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T06:19:51Z` 和消失上傳那一項。靜態產物仍是 `AdventureApp-wsEEgaCK.js`。

直接上傳的回應若在離開瀏覽器後消失，這筆算已經送過一次，不記下版本。之後的本機進度用新的請求編號和較新的本機存檔。`npm run typecheck` 通過。`npm test` 375 通過，其中「a lost upload response continues the newer local file under a new request id」涵蓋這項。

瀏覽器 `http://127.0.0.1:8178/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較晚落地的那一邊是經驗加 7，所以雲端經驗是 51；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 隔離物品的編號跟存檔一起上傳（本輪）

來源 `b1131cb` 接到 `9dfcec9`。後端檢查點自動合併。靜態產物仍是 `AdventureApp-wsEEgaCK.js`。

隔離物品和隔離裝備的物品編號維持遊戲已留下的字串，長度 1 到 64，可以含空白。整份存檔仍可上傳。一般裝備的物品編號仍是小寫、數字、冒號、底線或連字號。`npm run typecheck` 通過。`npm test` 377 通過，其中「an imported unknown item stays quarantined and can still upload」和「quarantine keeps imported item ids the game already kept」涵蓋這項。

瀏覽器 `http://127.0.0.1:8179/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 資料庫停掉時上傳留在佇列（本輪）

來源 `ab9e517` 接到 `d12a2d9`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T06:34:34Z` 和資料庫停機那一項。靜態遊戲腳本內容與上一版相同，檔名是 `AdventureApp-BpSHmHEQ.js`。

登入還在、資料庫回 503，或伺服器回 429、500 以上時，玩家已經要求送出的上傳留在這個帳號的佇列，算已經送過一次。存檔被拒時不排回佇列。`npm run typecheck` 通過。`npm test` 379 通過，其中「a database outage keeps the upload the player already asked to send」和「a rejected save is not queued after the database answers」涵蓋這項。

瀏覽器 `http://127.0.0.1:8180/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 圖書館坡道欄杆跟著坡面（本輪）

來源 `c065645` 接到 `6f75c3e`。美術文件和欄杆測試有衝突。欄杆擋人的斷言留下，坡面升高的斷言也留下。立柱的 X 多了一項檢查，確認仍落在碰撞上。靜態產物是 `AdventureApp-CCGkCYhn.js`。

圖書館坡道左右各有一道欄杆。立柱腳底跟著坡面，北側比南側高 0.921 m。橫桿從一根柱連到下一根。兩側碰撞仍是 0.12 m 厚、長 14 m，中心在坡面外側 0.95 m，立柱的 X 落在裡面。0.42 m 的身體站上欄杆會被推開。坡面中心和南端入口仍可走。克難坡不設欄杆。`npm run typecheck` 通過。`npm test` 379 通過，其中坡道欄杆測試涵蓋升高、桿的方向，以及身體被推開。

瀏覽器 `http://127.0.0.1:8181/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。第一次路線在戰鬥之後遇到程序關閉的 I/O 錯誤，重跑通過。

## 登入逾期時上傳留在這個帳號（本輪）

來源 `9a085af` 接到 `df20d53`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T06:43:34Z` 和登入逾期那一項。靜態產物仍是 `AdventureApp-CCGkCYhn.js`。

登入逾期回 401，或工作階段沒有使用者時，這不算換成別的帳號。這個帳號已經要求送出的上傳和獎勵留在自己的佇列。直接寫入若回來是未登入，也排回這個帳號，請求編號沿用。`npm run typecheck` 通過。`npm test` 382 通過，其中「an expired session keeps this account's upload and reward」、「a session with no user keeps this account's upload」和「a signed-out save write stays queued for this account」涵蓋這項。

瀏覽器 `http://127.0.0.1:8182/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 多樣玩法的累計建成次數可以超過 48（本輪）

來源 `d014318` 接到 `2925e8a`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T06:54:51Z` 和累計建成次數那一項。靜態產物是 `AdventureApp-C8YogH9P.js`。

同時站著的建築仍最多 48 座。多樣玩法能力快照裡的建成次數是累計，拆掉再蓋會往上加。雲端接受 0 到 10000000。本機讀回時收到 1000000。整份存檔仍可上傳。`npm run typecheck` 通過。`npm test` 384 通過，其中「a variety run still uploads after more stations were placed than can stand at once」和「a variety run can record more lifetime stations than the standing cap」涵蓋這項。

瀏覽器 `http://127.0.0.1:8183/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 田徑場內圈的草地界線（本輪）

來源 `6bf79fe` 接到 `873d831`。美術文件有衝突。坡道欄杆的紀錄留下，內圈界線記成第 60 輪。遊戲檔案沒有衝突。靜態產物是 `AdventureApp-BAll8kZV.js`。

田徑場內圈有 5 條白線，沒有球網。每條線的端點都在跑道內圈橢圓裡。20×20 m 的小場不畫。跑道環和分道留著。尺寸仍是 estimated。`npm run typecheck` 通過。`npm test` 385 通過，其中「the track infield is a pitch inside the oval」涵蓋這項。

瀏覽器 `http://127.0.0.1:8184/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 雲端列不見時，已排隊的上傳改做第一次同步（本輪）

來源 `320a536` 接到 `7c44b17`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T07:02:41Z` 和雲端列不見那一項。靜態產物仍是 `AdventureApp-BAll8kZV.js`。

已經排好的上傳仍帶著舊的版本號。雲端列不見時回 `first_sync_required`。確認仍是這個帳號後，用新的請求編號把目前本機存檔做成第一次同步，版本從 0 起算。另一個帳號的工作階段不會送出，該筆留在原帳號佇列。同一個帳號、雲端仍有別的內容時，衝突仍會放下該筆。`npm run typecheck` 通過。`npm test` 387 通過，其中「a queued upload lands when this account's cloud row is gone」和「an empty cloud does not take another account's queued upload」涵蓋這項。

瀏覽器 `http://127.0.0.1:8185/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 限流的獎勵回執先在本機發一次（本輪）

來源 `0f88ef7` 接到 `fff4452`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T07:11:41Z` 和限流獎勵那一項。靜態產物仍是 `AdventureApp-BAll8kZV.js`。

已登入時，獎勵回執若回 429，限流發生在寫入之前。這次先在本機發一次，回執留在這個帳號的佇列。422 不發獎，也不排進佇列。`npm run typecheck` 通過。`npm test` 389 通過，其中「a rate-limited reward is granted once and stays with this account」和「a rejected reward receipt is not granted or queued」涵蓋這項。

瀏覽器 `http://127.0.0.1:8186/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 長時間張望仍可上傳同一面向（本輪）

來源 `a42e4cd` 接到 `0e5b7a0`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T07:18:03Z` 和張望那一項。存檔函式自動合併。靜態產物是 `AdventureApp-C9_sOs73.js`。

存檔時把朝向折回同一圈。正負 100001 的朝向寫進存檔後落在 0 到一圈之間，面向與近戰判定不變，整份存檔仍可上傳。絕對值超過 100000 的座標仍會被拒。`npm run typecheck` 通過。`npm test` 390 通過，其中「a long look-around still uploads the same facing」涵蓋這項。

瀏覽器 `http://127.0.0.1:8187/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 八十個字的校園記憶仍可上傳（本輪）

來源 `ce2b4cd` 接到 `e5ef99ed`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T07:24:56Z` 和滿字記憶那一項。靜態產物是 `AdventureApp-BeZ7VYZM.js`。

敘事記憶的值可以到 80 個字。雲端檢查與本機匯入都收下這一行。81 個字仍被拒。鍵仍須短於 80。`npm run typecheck` 通過。`npm test` 391 通過，其中「a full-length campus memory still uploads」涵蓋這項。

瀏覽器 `http://127.0.0.1:8188/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 過長的地面掉落編號仍帶著物品上傳（本輪）

來源 `ba24f0cb` 接到 `8daa1ef`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T07:28:10Z` 和過長掉落編號那一項。存檔函式自動合併。靜態產物是 `AdventureApp-BsO770iL.js`。

超過 80 字的地面掉落編號在匯入時收成前 80 字。物品與委託標記還在，整份存檔仍可上傳。再匯入一次，編號、物品與委託標記都還在。沒有先匯入就直接送出更長的編號，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 392 通過，其中「a long ground-loot id still uploads with its items」涵蓋這項。

瀏覽器 `http://127.0.0.1:8189/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 用不了的地面堆仍帶著物品上傳（本輪）

來源 `a90f2b3` 接到 `0f5da63`。後端檢查點只在時間和完成清單上有衝突，留下較新的 `2026-11-12T07:30:24Z` 和用不了的地面堆那一項。存檔函式自動合併。靜態產物是 `AdventureApp-DhkxLjTO.js`。

空的地面掉落編號在匯入時換成新的編號，長度 1 到 80。座標絕對值超過 100000 的掉落會收到可走範圍內。附近編號 `pile-near` 的位置仍是 12、18。物品與委託標記留著，再匯入一次編號不變，整份存檔仍可上傳。沒有先匯入就直接送出這些值，雲端仍拒絕整份存檔。玩家自己的座標超過這個範圍仍會被拒。`npm run typecheck` 通過。`npm test` 393 通過，其中「an unusable ground pile still uploads its items」涵蓋這項。

瀏覽器 `http://127.0.0.1:8190/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 過遠的移動教學錨點仍可上傳（本輪）

來源 `d415927` 接到 `6e90df9`。後端檢查點自動合併，留下 `2026-11-12T07:32:59Z` 和過遠錨點那一項。存檔函式一併套上。靜態產物是 `AdventureApp-B7Fd-hdc.js`。

移動教學的錨點若絕對值超過 100000，匯入改用玩家站立的位置。教學步驟仍是移動，整份存檔可上傳，再匯入一次步驟不變。座標 10、20 的錨點保持原位。沒有先匯入就直接送出超出範圍的錨點，雲端仍拒絕整份存檔。玩家自己的座標超過這個範圍仍會被拒。`npm run typecheck` 通過。`npm test` 394 通過，其中「a move lesson with an unusable anchor still uploads」涵蓋這項。

瀏覽器 `http://127.0.0.1:8191/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 多餘的發現拿掉後，到過的校園據點仍可上傳（本輪）

來源 `9aea940` 接到 `1b24d66`。後端檢查點只在完成清單上有衝突，留下較新的 `2026-11-12T07:37:12Z` 和多餘發現那一項。存檔函式自動合併。靜態產物是 `AdventureApp-BzMNFSE0.js`。

存檔與匯入只留下校園清單裡的發現地點。`Not A Site` 和一長串文字會被拿掉，`library` 與 `gym` 仍在。再匯入一次，留下的地點不變，整份存檔仍可上傳。沒有先存檔就直接送出清單以外的發現文字，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 395 通過，其中「a stray discovery still uploads the sites already found」涵蓋這項。

瀏覽器 `http://127.0.0.1:8192/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 過遠的隔離裝備耐久仍可上傳（本輪）

來源 `a6a0825` 接到 `b1f473d`。後端檢查點自動合併，留下 `2026-11-12T07:40:08Z` 和過遠耐久那一項。裝備讀取一併套上。靜態產物是 `AdventureApp-DCmKs76_.js`。

隔離裝備的耐久若超出 0 到 100000，匯入收到這個範圍。150000 變成 100000，負數變成 0，40 維持不變。品質與物品編號留著，再匯入一次耐久不變，整份存檔可上傳。正在穿戴的目錄裝備仍依各自上限。沒有先匯入就直接送出超出範圍的耐久，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 396 通過，其中「an old piece of gear with a wild durability still uploads」涵蓋這項。

瀏覽器 `http://127.0.0.1:8193/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 超出範圍的敘事時鐘仍可上傳（本輪）

來源 `aac0f66` 接到 `09c7d7c`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T07:43:29Z` 和超出範圍時鐘那一項。敘事讀取與存檔一併套上。靜態產物是 `AdventureApp-CyJIUqME.js`。

敘事時鐘超出雲端範圍時，匯入把亂數折成 32 位元無號整數，分鐘收到 0 到 1000000。亂數 -1 變成 4294967295，分鐘 2000000 變成 1000000。亂數 12 與分鐘 480 維持不變。記憶留著，再匯入一次時鐘不變，整份存檔可上傳。沒有先匯入就直接送出超出範圍的時鐘，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 397 通過，其中「a narrative clock outside the cloud range still uploads」涵蓋這項。

瀏覽器 `http://127.0.0.1:8194/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 無法命名的敘事地點仍可上傳（本輪）

來源 `83a38aa` 接到 `f4929b4`。後端檢查點與存檔自動合併，留下 `2026-11-12T07:45:33Z` 和無法命名的地點那一項。敘事讀取與存檔一併套上。靜態產物是 `AdventureApp-9Z7wl42P.js`。

地點編號若含空白、大寫或超出 1 到 64 字，匯入改成沒有地點。系名超過 80 字改成沒有系名。`library` 與 `math` 留著，記憶留著，再匯入一次地點不變，整份存檔可上傳。沒有先匯入就直接送出雲端不接受的地點，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 398 通過，其中「a narrative place the cloud cannot name still uploads」涵蓋這項。

瀏覽器 `http://127.0.0.1:8195/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 超出範圍的敘事計時仍可上傳（本輪）

來源 `561a3e1` 接到 `eccee6d`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T07:47:43Z` 和超出範圍計時那一項。敘事讀取與存檔一併套上。靜態產物是 `AdventureApp-DRJHvt5m.js`。

冷卻與互斥時間收到 -1e12 到 1e15。1e16 變成 1e15，900 維持不變，-1e13 變成 -1e12。記憶留著，再匯入一次計時不變，整份存檔可上傳。沒有先匯入就直接送出超出範圍的計時，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 399 通過，其中「a narrative timer outside the cloud range still uploads」涵蓋這項。

瀏覽器 `http://127.0.0.1:8196/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。第一次截圖寫入碰到 I/O 錯誤，重跑同一站後通過。

## 空白的敘事鍵仍可上傳有名字的項目（本輪）

來源 `7c82d00` 接到 `26828b9`。後端檢查點自動合併，留下 `2026-11-12T07:49:32Z` 和空白鍵那一項。敘事讀取一併套上。靜態產物是 `AdventureApp-B5LHfT41.js`。

空白的敘事鍵會拿掉。`event-bell` 的 1200、`seen-gate`、圖書館記憶和 `event-rain` 留著。空白的事件名稱也拿掉。再匯入一次有名字的項目不變，整份存檔可上傳。沒有先匯入就直接送出空白鍵，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 400 通過，其中「an empty narrative key still uploads the named entries」涵蓋這項。

瀏覽器 `http://127.0.0.1:8197/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 過長的任務領取編號仍可上傳其他領取（本輪）

來源 `31a01db` 接到 `5bc4ad8`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T07:52:01Z` 和過長領取編號那一項。存檔一併套上。靜態產物是 `AdventureApp-CR0Zhon5.js`。

領取編號超過 64 字會拿掉。64 字的任務編號、`first` 與 `explorer` 留著。再匯入一次領取清單不變，整份存檔可上傳。沒有先匯入就直接送出超過 64 字的領取編號，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 401 通過，其中「a quest claim longer than the cloud allows still uploads the others」涵蓋這項。

瀏覽器 `http://127.0.0.1:8198/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 過長的朝聖清單仍可上傳（本輪）

來源 `5d1f259` 接到 `a91731f`。後端檢查點與存檔自動合併，留下 `2026-11-12T07:54:01Z` 和過長朝聖清單那一項。靜態產物是 `AdventureApp-BTzlvcX5.js`。

寫入存檔時，空白、超過 64 字和重複的朝聖編號會拿掉，只留前面 32 個。`kenan` 留在最前面，`stamp-0` 留著。再匯入一次清單不變，整份存檔可上傳。沒有先存檔就直接送出超過 32 筆、或單筆超過 64 字的巡禮編號，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 402 通過，其中「a long pilgrimage list still uploads the rpg save」涵蓋這項。

瀏覽器 `http://127.0.0.1:8199/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 空白的多樣玩法筆記仍可上傳有名字的項目（本輪）

來源 `73a0298` 接到 `a0806b6`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T07:59:27Z` 和空白筆記那一項。靜態產物是 `AdventureApp-CVNxMBj0.js`。

近況、已解和領取清單裡的空白筆記會拿掉。79 字的有名字項目留下，80 字的不留。`real-event` 與 `quest-walk` 留著。再匯入一次有名字的項目不變，整份存檔可上傳。沒有先匯入就直接送出空白筆記，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 403 通過，其中「an empty variety note still uploads the named beats」涵蓋這項。

瀏覽器 `http://127.0.0.1:8200/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 過長的多樣玩法筆記仍可上傳這一回合（本輪）

來源 `7eb68b8` 接到 `cfa1cbd`。後端檢查點自動合併，留下 `2026-11-12T08:03:45Z` 和過長筆記那一項。靜態產物是 `AdventureApp-Dt20vlro.js`。

失敗原因和回執超過 80 字會收到 80 字。80 字的失敗原因留下，回執「筆記送到了。」留著。學院名稱超過 80 字改成沒有學院，`engineering` 與 `lab` 留著。事件編號超過 80 字的進行中回合拿掉，`gv-night-patrol` 的已解項目留著。訊號裡任務編號含空白或大寫、或事件編號超過 80 字的拿掉，`quest-gv-library-clues` 留著。再匯入一次剪過的筆記不變，整份存檔可上傳。沒有先匯入就直接送出超過 80 字的失敗原因，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 404 通過，其中「a long variety note still uploads the run」涵蓋這項。

瀏覽器 `http://127.0.0.1:8201/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 空白的敘事種子仍可上傳校園記憶（本輪）

來源 `1ae3794` 接到 `311dca1`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T08:07:01Z` 和空白種子那一項。存檔自動合併。靜態產物是 `AdventureApp-deMaQQIO.js`。

空白或 64 字的敘事種子換成 `campus`。63 字的種子留下。亂數 12、分鐘 480、圖書館記憶「還在圖書館。」留著。再匯入一次種子不變，整份存檔可上傳。沒有先匯入就直接送出空白或 64 字的種子，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 405 通過，其中「an empty narrative seed still uploads the campus memory」涵蓋這項。

瀏覽器 `http://127.0.0.1:8202/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 過期的採集冷卻不擋還在冷卻的補給站（本輪）

來源 `92c9490` 接到 `95d35d1`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T08:13:16Z` 和過期採集冷卻那一項。存檔自動合併。靜態產物是 `AdventureApp-CUfRaW1c.js`。

已過期的 120 筆不寫進存檔。還在 180 秒內的地上補給點和 `facility:station-1` 留下。`facility:constructor` 拿掉。建築已經不在、冷卻還沒結束的 `facility:gone-station` 仍留下。再匯入一次還在冷卻的項目不變，筆數仍在 112 以內，整份存檔可上傳。沒有先存檔就直接送出超過 112 筆，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 406 通過，其中「an old harvest cooldown still uploads the stations that are cooling」涵蓋這項。

瀏覽器 `http://127.0.0.1:8203/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 滿了的隔離清單仍可上傳（本輪）

來源 `ea8f79d` 接到 `459e60e`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T08:20:24Z`、`eccee6d` 的合併註記，以及滿了的隔離清單那一項。存檔自動合併。靜態產物是 `AdventureApp-D0wh4st4.js`。

隔離清單已經 24 筆時，寫入只留前 24 筆，背包裡多出來的 `extra-book` 不留下。清單只有 23 筆時，`extra-book` 以數量 2 併進去，筆數仍在 24 以內。`kept-0` 留在最前面，生命 80 和 `station-1` 留下。再匯入一次仍是 24 筆，整份存檔可上傳。沒有先存檔就直接送出超過 24 筆，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 407 通過，其中「a full quarantine list still uploads the campus save」涵蓋這項。

瀏覽器 `http://127.0.0.1:8204/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 種類太多的地面堆仍可上傳（本輪）

來源 `bb21e92` 接到 `6b2c8c1`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T08:28:30Z`、`26828b9` 的合併註記，以及種類太多的地面堆那一項。存檔自動合併。靜態產物是 `AdventureApp-DqnAKwdh.js`。

17 種物品的地面堆在寫入時拆成每堆最多 16 種。第一堆編號仍是 `pile-wide`，筆記數量 2，委託標記留在這一堆。銅和野外燈都還在。正好 16 種的堆維持一堆，編號仍是 `pile-fit`。生命 80 和 `station-1` 留下。再匯入一次物品與委託標記不變，整份存檔可上傳。沒有先存檔就直接送出一堆超過 16 種，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 408 通過，其中「a crowded ground pile still uploads every item」涵蓋這項。

瀏覽器 `http://127.0.0.1:8205/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 腳邊那一堆仍收下多餘的筆記（本輪）

來源 `6374081` 接到 `67f6cdf`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T08:35:57Z`、`5bc4ad8` 的合併註記，以及腳邊那一堆那一項。存檔自動合併。靜態產物是 `AdventureApp-CCnWZOWf.js`。

背包已經滿、地上已經有 100 堆時，多樣玩法多出來的 4 本筆記加到腳邊的 `pile-feet`。那一堆的筆記從 1 變成 5。地面堆數仍在 100 以內。生命 80 和 `station-1` 留下。再匯入一次筆記仍是 5，整份存檔可上傳。沒有先存檔就直接送出第 101 堆，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 409 通過，其中「a full ground still keeps a variety overflow on the pile already there」涵蓋這項。

瀏覽器 `http://127.0.0.1:8206/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 用過的請求編號仍送出較新的本機存檔（本輪）

來源 `6b90cd6` 接到 `3b5a11c`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T08:57:02Z`、`a91731f`、`a0806b6`、`95d35d1` 的合併註記，以及用過的請求編號那一項。雲端客戶端直接套上。靜態產物仍是 `AdventureApp-CCnWZOWf.js`。

佇列裡的上傳若用已經落地的請求編號重送不同內容，會換成新編號，從這台裝置已落地的版本繼續。本機經驗 4 寫上雲端，版本變成 2，基準版本是 1。另一台裝置已經把經驗改成 7 時，本機經驗 4 留在本機，雲端維持 7，並標成版本衝突，佇列清空。`npm run typecheck` 通過。`npm test` 411 通過，其中「a reused request id continues the newer local file from this device's save」和「a reused request id does not overwrite another device's save」涵蓋這項。

瀏覽器 `http://127.0.0.1:8207/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。雲端客戶端改了，路線伺服器會匯入它，所以仍跑這條路線。

## 被拒的上傳仍送出較新的本機存檔（本輪）

來源 `99d4b2b` 接到 `1eb7a3b`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T09:04:56Z`、`459e60e` 的合併註記，以及被拒的上傳那一項。雲端客戶端直接套上。靜態產物仍是 `AdventureApp-CCnWZOWf.js`。

上傳被拒時，這個請求編號記成已經送出。之後本機改成經驗 9，會換新編號，從這台裝置已落地的版本繼續。雲端版本變成 2，基準版本是 1。另一台裝置已經把經驗改成 7 時，本機經驗 9 留在本機，雲端維持 7，並標成版本衝突，佇列清空。`npm run typecheck` 通過。`npm test` 413 通過，其中「a refused upload keeps the newer local file on this device's revision」和「a refused upload does not overwrite another device's save」涵蓋這項。

瀏覽器 `http://127.0.0.1:8208/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。雲端客戶端改了，路線伺服器會匯入它，所以仍跑這條路線。

## 停住的後續上傳仍送出較新的本機存檔（本輪）

來源 `304001b` 接到 `dd6a7f3`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T09:16:45Z`、`6b2c8c1`、`67f6cdf` 的合併註記，以及停住的後續上傳那一項。雲端客戶端直接套上。靜態產物仍是 `AdventureApp-CCnWZOWf.js`。

從這台裝置自己的版本繼續送出時，伺服器回 500，這份較新的本機存檔留在佇列。經驗 9、基準版本 2、嘗試 1。雲端仍是版本 2、經驗 4。本機經驗仍是 9。過一秒再送，雲端變成版本 3、經驗 9，佇列清空，狀態是 in_sync。429 走同一條。後續上傳被拒時暫停，嘗試至少 1，佇列留著經驗 9。暫停期間雲端經驗仍是 4。之後本機改成經驗 12，換新編號送出，基準版本是 2，雲端版本變成 3、經驗 12。空雲端的第一次同步被拒時也暫停，佇列仍標成第一次同步，經驗 9。之後本機經驗 12 換新編號寫上，雲端版本是 1、經驗 12。`npm run typecheck` 通過。`npm test` 416 通過，其中「an interrupted follow-up keeps the newer local file queued」、「a refused follow-up keeps the newer local file on this device's revision」和「a refused first sync keeps the newer local file」涵蓋這項。

瀏覽器 `http://127.0.0.1:8209/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。雲端客戶端改了，路線伺服器會匯入它，所以仍跑這條路線。

## 滿地的一堆拆開後仍留下每一樣物品（本輪）

來源 `eccb474` 接到 `1be6a82`。後端檢查點在時間和已完成清單衝突，留下 `2026-11-12T09:30:42Z`、基準 `dd6a7f3`、`3b5a11c` 與 `dd6a7f3` 的合併註記，以及滿地拆堆那一項。存檔程式自動合併。靜態產物換成 `AdventureApp-DvHwdDRF.js`。

地面已經有 100 堆，其中 `pile-wide` 有 17 種物品，必須拆成兩堆。兩堆的物品種類和數量都還放得下時，先併成一堆，空出的位置留給拆出來的那一塊。筆記合計仍是 100。野外燈留在 x 12、z 18，任務標記也在。`pile-wide` 的筆記任務標記留下。生命 80 和 `station-1` 留下。每一堆仍不超過 16 種，地面堆數仍在 100 以內。再匯入一次，筆記仍是 100，野外燈和任務標記還在，整份存檔可上傳。沒有先合併就直接送出超過 100 堆，或一堆超過 16 種，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 417 通過，其中「a full ground still keeps every kind when one pile must split」涵蓋這項。

瀏覽器 `http://127.0.0.1:8210/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 十二根車阻擋住行走的身體（本輪）

來源 `f5ee0ba` 接到 `d5b89c4`。美術文件在檢查點、交接、來源、狀態和驗收衝突。田徑場內圈留在第 60 輪，車阻記成第 61 輪。遊戲程式直接套上，截圖腳本自動合併。靜態產物換成 `AdventureApp-WcRwHzcr.js`。

坡底兩根和海豚圓環十根車阻共用同一份座標，直徑 0.22 m。半徑 0.42 m 站在坡底西側柱心會被推開超過 0.2 m。柱南 1.2 m 仍站得住。圖書館巡禮和主巡禮從圓環東北側的缺口出去，再沿圓環北側回到中線。折線轉折點不被推開，路燈離柱超過 1.2 m。田徑場內圈和坡道欄杆留著。`npm run typecheck` 通過。`npm test` 418 通過，其中「bollards stop a body and the pilgrimage lines stay open」涵蓋這項。

瀏覽器 `http://127.0.0.1:8211/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 滿地時多出來的物品仍疊上既有的一堆（本輪）

來源 `e93edbf` 接到 `4e6a7df`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T09:39:10Z`、`1be6a82` 的合併註記，以及疊上既有那一堆的項目。測試數改成這棵樹上的 419。存檔程式自動合併。靜態產物換成 `AdventureApp-BhvcT2Nf.js`。

地面已經有 100 堆，其中一堆有 17 種物品必須再拆。新的位置不夠時，多出來的物品疊到還有空位的那一堆。同一位置的堆先收。野外燈有一堆是 98，上限 99，多出來的 1 盞疊上去，合計 9801，任務標記也在那一堆。燈油仍是 1。筆記是 9802。生命 80 和 `station-1` 留下。每一堆仍不超過 16 種，地面堆數仍在 100 以內。再匯入一次，數量和任務標記還在，整份存檔可上傳。沒有先疊上就直接送出超過 100 堆，或一堆超過 16 種，雲端仍拒絕整份存檔。`npm run typecheck` 通過。`npm test` 419 通過，其中「a full stack ground still keeps an extra kind that already has room」涵蓋這項。

瀏覽器 `http://127.0.0.1:8212/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 兩堆合併時任務標記加在一起（本輪）

來源 `2fbbad8` 接到 `b03df4b`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T09:42:39Z`、`d5b89c4` 的合併註記，以及任務標記加總的項目。測試數改成這棵樹上的 420。存檔程式自動合併。靜態產物換成 `AdventureApp-BWn6iYtn.js`。

地面已經有 100 堆。其中兩堆筆記各帶 1 筆任務標記，還有一堆 17 種物品帶著筆記和野外燈各 1 筆任務標記。新的位置不夠，兩堆筆記先合併。任務標記加在一起：兩筆變成 2，再加上拆出來的那一筆，合計 3。筆記仍是 100。野外燈仍是 1。每一筆任務標記都不超過那一堆的數量。生命 80 和 `station-1` 留下。再匯入一次，任務標記仍是 3，整份存檔可上傳。`npm run typecheck` 通過。`npm test` 420 通過，其中「merging piles on a full ground keeps every quest mark」涵蓋這項。

瀏覽器 `http://127.0.0.1:8213/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 灑出來的委託筆記不計入收集（本輪）

來源 `822b747` 接到 `de1d7c1`。後端檢查點只在測試數衝突，留下 `2026-11-12T09:48:17Z` 和灑出來的委託筆記那一項。測試數改成這棵樹上的 421。存檔程式和介面說明自動合併。靜態產物換成 `AdventureApp-D5foKFPP.js`。

背包已經放滿筆記。站在有筆記的補給點領校園委託，地上那堆是 6 本：補給點自己的 4 本，委託多出來的 2 本帶任務標記。當時收集仍是 0。撿起來以後，收集只加上補給點的 4 本。存檔裡任務標記仍是 2，整份可上傳。`npm run typecheck` 通過。`npm test` 421 通過，其中「an errand that spills notes keeps those notes out of collection」涵蓋這項。

瀏覽器 `http://127.0.0.1:8214/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 灑出來的多樣獎勵不計入收集（本輪）

來源 `4a6afda` 接到 `fe1ed26`。後端檢查點在基準提交和測試數衝突，留下 `2026-11-12T09:51:59Z`、基準 `4e6a7df`，以及多樣筆記那一項。存檔程式和介面說明自動合併。靜態產物換成 `AdventureApp-C-C9gvht.js`。

背包已經放滿零件和筆記。多樣玩法結算要給 4 本筆記，全部灑到地上，4 本都帶任務標記。當時收集仍是 0。撿起來以後，收集仍是 0。存檔裡任務標記仍是 4，整份可上傳。學分若背包放不下，同樣帶這個標記。`npm run typecheck` 通過。`npm test` 422 通過，其中「variety notes that miss the bag stay out of collection」涵蓋這項。

瀏覽器 `http://127.0.0.1:8215/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 合法的累計建造次數匯入後留著

來源 `aec6ded` 接到 `7edd533`。後端檢查點只在已完成清單衝突，留下 `2026-11-12T09:56:41Z`、`b03df4b` 的合併註記，以及累計建造次數那一項。存檔程式和能力快照自動合併。靜態產物換成 `AdventureApp-BymKMTuT.js`。

累計建造次數 1,000,001 在雲端上限 10,000,000 以內。匯入和讀檔都留下 1,000,001。進行中的多樣玩法是 `gv-night-patrol`，能力快照裡的建造次數也是 1,000,001。整份存檔可上傳。再匯入一次，次數和事件都還在。`npm run typecheck` 通過。`npm test` 423 通過，其中「a lifetime build count inside the cloud cap survives import」涵蓋這項。

瀏覽器 `http://127.0.0.1:8216/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 合法的經驗、擊退和時鐘匯入後留著

來源 `80c96f3` 接到 `342e6b2`。存檔程式的經驗上限和後端檢查點的已完成清單衝突。經驗、擊退、建造次數都留在 10,000,000，時鐘留在 1e15。檢查點留下 `2026-11-12T09:59:24Z`、`de1d7c1` 的合併註記，以及經驗、擊退和時鐘那一項。測試數維持 424。靜態產物換成 `AdventureApp-0uhEOH1T.js`。

經驗、擊退、時鐘都是 1,000,001。經驗和擊退的上限是 10,000,000，時鐘的上限是 1e15。匯入和讀檔都留下 1,000,001。時鐘對 300 的餘數仍是 1,000,001 的餘數，異象週期不撥回。整份存檔可上傳。再匯入一次，三個數字都還在。生命 80 和科系數學是測試起始狀態。`npm run typecheck` 通過。`npm test` 424 通過，其中「experience, defeats, and the game clock inside the cloud cap survive import」涵蓋這項。

瀏覽器 `http://127.0.0.1:8217/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 確認匯入後，活著的室內存檔從同一份檔案繼續

來源 `86adb5f` 接到 `6655b94`。後端檢查點在更新時間和已完成清單衝突，留下 `2026-11-12T10:14:08Z`、`fe1ed26` 的合併註記，以及室內樓層那一項。測試數維持 426。回家程式和介面說明自動合併。靜態產物換成 `AdventureApp-BcBedLA4.js`。

確認一份活著的室內存檔（生命 40、經驗 12、圖書館 3 樓）以後，遊戲進入進行中。存檔留下圖書館和 3 樓，人也在圖書館 3 樓，站在 x 0、z 4。整份可上傳。生命是 0 的存檔確認後留在門外：室內清空、樓層回到 1，生命仍是 0，存檔可上傳。`npm run typecheck` 通過。`npm test` 426 通過，其中「confirming an import keeps a living interior floor」和「confirming an import of a dead save stays outside」涵蓋這兩項。

瀏覽器 `http://127.0.0.1:8218/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 第一次匯入沒有本機檔時，活著的室內存檔也從同一份原文繼續

來源 `92b3440` 接到 `c0cfc2a`。設定面板的選檔和後端檢查點衝突。直接匯入用已經讀過的原文。檢查點留下 `2026-11-12T10:32:00Z`、`342e6b2` 的合併註記，以及直接匯入那一項。測試數維持 428。回家程式自動合併。靜態產物換成 `AdventureApp-DFIHI42O.js`。

本機還沒有存檔時，選檔是直接匯入。活著的圖書館 3 樓（生命 40、經驗 12）寫回存檔，人站在 x 0、z 4。整份可上傳。生命是 0 的直接匯入留在標題畫面，室內清空、樓層回到 1，生命仍是 0，存檔可上傳。設定面板和標題畫面都走這條。`npm run typecheck` 通過。`npm test` 428 通過，其中「a direct import keeps a living interior floor」和「a direct import of a dead save stays outside」涵蓋這兩項。

瀏覽器 `http://127.0.0.1:8219/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 公共室內有天花板

來源 `01ab365` 接到 `f2656a5`。美術檢查點、交接、來源說明、狀態、驗收和截圖腳本衝突。留下車阻、田徑場內圈和坡道欄杆，並補上天花板。房間程式和測試自動合併。靜態產物換成 `AdventureApp-BEjfJSKK.js`。

公共室內共用的房間頂部有一塊 20×16 m、厚 0.16 m 的天花板，中心在 4.32 m，上緣貼著 4.4 m 的牆頂。宮燈教室看得到淺色天花接到牆。房間仍不是實測。`npm run typecheck` 通過。`npm test` 429 通過，其中「public interiors have a ceiling on the wall tops」涵蓋這項。

瀏覽器 `http://127.0.0.1:8220/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 室內持續回復生命時，樓層仍寫進存檔

來源 `b17268c` 接到 `e786932`。存檔排程和後端檢查點的已完成清單衝突。第一次變動留著原來的 1.8 秒期限，不再被後來的回復清掉重排。檢查點留下 `2026-11-12T10:36:30Z`、`6655b94` 的合併註記，以及室內回復那一項。測試數改成這棵樹實際的 430。靜態產物換成 `AdventureApp-DAgUMSO-.js`。

人先在外面，存檔寫下。接著進圖書館 3 樓，生命從 30 開始持續回復。存檔留下圖書館和 3 樓，生命高於 30。人仍在圖書館 3 樓。整份可上傳。`npm run typecheck` 通過。`npm test` 430 通過，其中「healing indoors still writes the living floor」涵蓋這項。

瀏覽器 `http://127.0.0.1:8221/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 巡禮章在下一動之前寫進 RPG 存檔

來源 `36c47f0` 接到 `9962c04`。遊戲訂閱和後端檢查點的已完成清單衝突。蓋章、靜音或改時段會立刻寫入 RPG 存檔；人只是移動時，仍等原來的存檔期限。檢查點留下 `2026-11-12T10:42:00Z`、室內回復那一項、`f2656a5` 的合併註記，以及巡禮章那一項。測試數改成這棵樹實際的 431。靜態產物換成 `AdventureApp-C9EuORbk.js`。

人站在 x 10、z 12。存檔裡還沒有克難坡的章，聲音開著，時段是白天。接著蓋下克難坡的章、切成靜音、時段改成夜晚。人還沒移動，位置仍是 x 10、z 12。RPG 存檔立刻有這一章、靜音和夜晚。整份可上傳。`npm run typecheck` 通過。`npm test` 431 通過，其中「a landmark stamp is in the rpg save before the next move」涵蓋這項。

瀏覽器 `http://127.0.0.1:8222/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 室內往下看時，鏡頭留在天花下

來源 `7ded28e` 接到 `709f08e`。美術檢查點、交接、狀態和驗收紀錄衝突。往下看的上限寫進去，車阻、田徑場內圈和坡道欄杆的已完成段落留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-DSjIJXEf.js`。測試數是 432。

室內俯角 0.6 和 1.12 若不限制，鏡頭會高過天花板底。限制後鏡頭不高於板底下方 0.35 m。人仍在畫面裡。室外俯角不受這道上限。天花上緣仍貼著 4.4 m 的牆頂。`npm run typecheck` 通過。`npm test` 432 通過，其中「a downward indoor look stays under the ceiling」涵蓋這項。

瀏覽器 `http://127.0.0.1:8223/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 室內南門走得出去

來源 `d3c8f66` 接到 `d6099f3`。美術文件和截圖腳本衝突。南門半寬改成 2.5 m，車阻、天花往下看、田徑場內圈和坡道欄杆的已完成段落留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-BvzNIml0.js`。測試數是 433。

南門開口半寬 2.5 m，和牆的內緣一致。半徑 0.42 m 從開口往外走會離開房間。x = 2.8 m 貼著門框出不去。體育館不擋閱讀桌的位置。走出去回到該棟門外。`npm run typecheck` 通過。`npm test` 433 通過，其中「the interior doorway matches the wall opening」涵蓋這項。

瀏覽器 `http://127.0.0.1:8224/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 教育館有南向雨遮

來源 `6d41e54` 接到 `f6d2d5c`。美術文件和截圖腳本衝突。教育館改成自己的教室樓，室內南門、天花往下看、車阻、田徑場內圈和坡道欄杆的已完成段落留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-D2jQsO3t.js`。測試數是 434。

教育館是 class-hall。會文館仍是 study-block。外語大樓仍是 language-hall。雨遮高 3.1 m，比樓身窄，伸到南牆外面。樓層遮陽比樓層數少一條。雨遮是估計剪影。`npm run typecheck` 通過。`npm test` 434 通過，其中「the education hall has its own classroom canopy」涵蓋這項。

瀏覽器 `http://127.0.0.1:8225/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 松濤二館有公共門面

來源 `78ad4ea` 接到 `fbef701`。美術文件、截圖腳本和教室樓匯入衝突。松濤二館改成公共門面，教育館、室內南門、天花往下看、車阻、田徑場內圈和坡道欄杆的已完成段落留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-BMq2a5-L.js`。測試數是 435。

松濤二館是 dorm-front。一、三、四、五館仍是 dorm-block。麗澤仍是 intl-dorm。門廳低於樓高的四分之一，玻璃在南牆外，雨遮接到南牆。清冊寫著文錙藝術中心和美食廣場。門面是估計剪影。`npm run typecheck` 通過。`npm test` 435 通過，其中「Sungtao 2 keeps a public ground floor and the other halls stay dorms」涵蓋這項。

瀏覽器 `http://127.0.0.1:8226/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 坡道旁的長椅和花台讓出坡面

來源 `30580d3` 接到 `e1af2a3`。美術文件衝突。長椅和花台改到坡面外面，松濤二館、教育館、室內南門、天花往下看、車阻、田徑場內圈和坡道欄杆的已完成段落留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-B6lbdES4.js`。測試數是 436。

靠坡的長椅在 x=-4.8。1.7 m 座椅範圍的坡道高度是 0。對準坡道的花台比坡道南端更南。六張圖書館長椅和八個花台都是這樣。位置仍是 estimated。`npm run typecheck` 通過。`npm test` 436 通過，其中「library benches and planters stay off the ramp」涵蓋這項。

瀏覽器 `http://127.0.0.1:8227/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 閱讀的女孩坐在西側長椅

來源 `c44667c` 接到 `8a592c7`。長椅迴圈、美術文件和截圖腳本衝突。西側 x=-12 的長椅留著，靠坡那張仍在 x=-4.8，沒有改回等距排列。松濤二館、教育館、室內南門、天花往下看、車阻、田徑場內圈和坡道欄杆的已完成段落留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-6wIH-ZA2.js`。測試數是 437。

雕像的座位在西側長椅，坡道高度是 0。同一條 z 的坡道中線仍高出廣場。腳底用那裡的地面。座位仍是 estimated。`npm run typecheck` 通過。`npm test` 437 通過，其中「the reading girl sits on a bench beside the library ramp」涵蓋這項。

瀏覽器 `http://127.0.0.1:8228/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 五虎崗機車停車場的車格

來源 `d798fa23` 接到 `868124b`。`ContextStructures.tsx` 的匯入同時留下田徑場內圈和機車格。測試匯入同時留下內圈橢圓檢查和機車格。美術文件衝突。閱讀的女孩、靠坡的長椅、松濤二館、教育館、室內南門、天花往下看、車阻、田徑場內圈和坡道欄杆的已完成段落留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-HPXzNEa2.js`。測試數仍是 437。

停車場有 50 條車格線：兩條底線和 48 條分隔，南北各 23 個寬 2.4 m、深 4 m 的車格。每條線都在鋪面裡，最靠近中線的一端離中心至少 10 m。球場和田徑場沒有這些車格。十二條舊的中線仍穿過車道，長度是鋪面進深的四分之三。車格尺寸仍是 estimated。`npm run typecheck` 通過。`npm test` 437 通過，其中「open courts keep their painted lines inside the grass」涵蓋車格。

瀏覽器 `http://127.0.0.1:8229/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 車道不再畫線

來源 `1788c30` 接到 `868456ae`。美術文件衝突。機車格、閱讀的女孩、靠坡的長椅、松濤二館、教育館、室內南門、天花往下看、車阻、田徑場內圈和坡道欄杆的已完成段落留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-COgoRz7i.js`。測試數仍是 437。

貫穿車道中央的十二條舊線已拿掉。每條舊線長是鋪面進深的四分之三。邊上的機車格留著，車道不再畫線。畫面不再含 `s.size[2] * 0.75`。`npm run typecheck` 通過。`npm test` 437 通過，其中「open courts keep their painted lines inside the grass」涵蓋這項。

瀏覽器 `http://127.0.0.1:8230/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 球場球網改成柱子和細帶

來源 `3e4bec2` 接到 `462ee32`。球網函式、畫面匯入、測試和截圖腳本衝突。機車格、田徑場內圈和先前的里程留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-BNiW9u13.js`。測試數仍是 437。

每張網有兩根高 2.2 m 的柱，頂帶和網同長但高度小於 0.1 m。沒有又長又高的一片。不是網的邊線不會產生網件。球場仍沒有碰撞。網高仍是 estimated。`npm run typecheck` 通過。`npm test` 437 通過，其中「open courts keep their painted lines inside the grass」涵蓋這項。

瀏覽器 `http://127.0.0.1:8231/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。第一次跑到戰鬥後瀏覽器關閉時遇到 EIO，同一條路線重跑通過。靜態產物換了，所以重跑這條路線。

## 未引用的照片貼圖移出靜態站

來源 `06f41bd` 接到 `af57061`。美術文件衝突。球場球網、機車格和先前的里程留著。JS 產物仍是 `AdventureApp-BNiW9u13.js`。測試數從 437 變成 438。

`public/textures` 不存在。`src` 與 `index.html` 沒有 `/textures/`。刪掉的四張是 grass.jpg 393,689 bytes、palace-wall.jpg 274,113、roof.jpg 259,235、stone.jpg 272,724，合計 1,199,761 bytes。`build:site` 之後 `dist/textures` 不存在，`dist/assets` 也沒有 `cloud-save` 或 `DATABASE_URL`。材質庫仍是 `public/materials/tamkang`。meshopt 與 KTX2 仍是 planned。`npm run typecheck` 通過。`npm test` 438 通過，其中「unreferenced photo textures are not part of the static site」涵蓋這項。

JS 產物的檔名和大小都沒變，跨系統路線沒有重跑，仍是 8231 那一次：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。

## 海事博物館船首接到前臉

來源 `2d81b0b` 接到 `d4d99a5`。截圖腳本和美術文件衝突。未引用貼圖、球場球網和先前的里程留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-CM7g8qKG.js`。測試數從 438 變成 439。

船首底邊落在前臉內側 0.08 m，四個角蓋滿前臉的高和寬，尖端在前臉前方、高度在船身中線。四個三角面的繞序朝內，外側會被剔除。船身長度仍是 estimated。`npm run typecheck` 通過。`npm test` 439 通過，其中「the maritime museum bow covers the forward face」涵蓋這項。

瀏覽器 `http://127.0.0.1:8232/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 船首四個面朝外

來源 `d0fd98b` 接到 `96720f7`。美術文件衝突。船首位置、未引用貼圖和先前的里程留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-DsvdB1IF.js`。測試數仍是 439。

四個面的法線朝外：底面向下、頂面向上、南面 +Z、北面 -Z。船首仍蓋住前臉再收到尖端。船身長度仍是 estimated。`npm run typecheck` 通過。`npm test` 439 通過，其中「the maritime museum bow covers the forward face」涵蓋法線。

瀏覽器 `http://127.0.0.1:8233/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 會文館柱廊

來源 `412b130` 接到 `0256726`。量體分派、繪製、測試和美術文件衝突。教育館仍是 `class-hall`，外國語文大樓仍是 `language-hall`。船首和先前的里程留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-D5dZSqEe.js`。測試數仍是 439。

會文館是 `seminar-hall`。柱廊貼著南牆，高度留在地面一層。柱廊外形仍是 estimated。`npm run typecheck` 通過。`npm test` 439 通過，其中「dorm, lab, and sport masses stay distinct and estimated」和「the education hall has its own classroom canopy」涵蓋這項。

瀏覽器 `http://127.0.0.1:8234/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 司令臺台面可以站人

來源 `bc5715b` 接到 `b0f0561`。碰撞、走路高度、植栽和美術文件衝突。圖書館坡道的抬升留著。亭柱留著。會文館柱廊留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-CUNQXjpT.js`。測試數從 439 變成 440。

半徑 0.42 m 可以站在司令臺南半台面。後方小間仍把人推開。台面比周圍地面高 1.25 m，台緣外 1.6 m 是一半高度，再外 8 m 回到地面。台高仍是 estimated。坡面這輪還沒有自己的網格。`npm run typecheck` 通過。`npm test` 440 通過，其中「the reviewing deck can be stood on and the booth still blocks」涵蓋這項。

瀏覽器 `http://127.0.0.1:8235/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 司令臺坡面有土

來源 `f2750c7` 接到 `36e88ef`。繪製、測試和美術文件衝突。船首留著。台面高度留在上一輪。檢查點的靜態產物改成這棵樹的 `AdventureApp-CAvp3y0D.js`。測試數仍是 440。

地面網格在台外畫出同一條坡。人站在坡上時腳下有土。台面仍比周圍地面高 1.25 m。後方小間和兩根棚柱仍擋住。台高仍是 estimated。`npm run typecheck` 通過。`npm test` 440 通過，其中「the reviewing deck can be stood on and the booth still blocks」涵蓋坡面高度。

瀏覽器 `http://127.0.0.1:8236/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 低畫質路人用程序學生

來源 `9672ff3` 接到 `2747a55`。繪製、測試和美術文件衝突。司令臺坡面留著。船首留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-7L6j7Fgv.js`。測試數從 440 變成 441。

高畫質路人用角色組，140 m 外不繪製。低畫質改用程序學生，90 m 外不繪製，不載入 npc-kit。`npm run typecheck` 通過。`npm test` 441 通過，其中「low quality keeps NPC walkers on the procedural stand-in」涵蓋這項。

瀏覽器 `http://127.0.0.1:8237/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 傳輸預算已量過

來源 `9a3d594` 接到 `5fa72bd`。美術文件衝突。低畫質路人、司令臺坡面和先前的里程留著。JS 產物仍是 `AdventureApp-7L6j7Fgv.js`。測試數從 441 變成 442。

七個 GLB 的檔名集合被鎖住。node:zlib 量到 raw 4,295,184 bytes、gzip 1,704,638 bytes。主角套組 gzip 459,773，省電 LOD1 gzip 279,457，npc-kit gzip 607,919。決定先不加 meshopt 或 KTX2，因為還沒有真機傳輸紀錄。超標或新增 GLB 會讓測試失敗。`npm run typecheck` 通過。`npm test` 442 通過，其中「committed game-art stays inside the measured transfer budget」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

JS 產物的檔名和大小都沒變，跨系統路線沒有重跑，仍是 8237 那一次：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。

## 宮燈大道四時段

來源 `266e4b7` 接到 `e95a4d1`。美術文件衝突。傳輸預算、低畫質路人和先前的里程留著。JS 產物仍是 `AdventureApp-7L6j7Fgv.js`。測試數從 442 變成 443。

同一站點 (0, -80) 的晴天路燈滅。夕照從西邊來且路燈亮。夜的太陽強度低於晴天兩成且路燈亮。雨後濕度是 1。不是實測日照。`npm run typecheck` 通過。`npm test` 443 通過，其中「day, sunset, night, and wet are distinct avenue presets」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

JS 產物的檔名和大小都沒變，跨系統路線沒有重跑，仍是 8237 那一次：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。

## 宮燈教室轉角鏡頭

來源 `3ce5f17` 接到 `9acf00f6`。跟隨鏡頭、美術文件和截圖腳本衝突。室內天花上限留著。四時段、傳輸預算和低畫質路人留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-DZ-huzUW.js`。測試數從 443 變成 444。

西廳轉角的目標點在廳內。舊的推出離開視線超過 1 m。新的鏡頭留在視線上，側向偏移小於 0.05 m，距離至少 2.15 m。水平距離不夠 2.2 m 就升高。迴廊外側直走的水平距離仍大於 4.8 m。室內跟隨鏡頭仍停在天花下。`npm run typecheck` 通過。`npm test` 444 通過，其中「colonnade corner keeps the follow camera on the view line」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8238/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 廣場路燈燈頭

來源 `2b45515` 接到 `83548e37`。道具繪製、截圖腳本和美術文件衝突。圖書館坡道網格留著。宮燈教室轉角鏡頭、四時段和傳輸預算留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-50MxVB9u.js`。測試數從 444 變成 446。

廣場路燈的燈頭跟著宮燈用的同一個 `lampsOn`。晴天發光強度是 0，夜裡大於 1。偏航 0 時燈臂在 -X。燈頭位置取自模型比例，不是實測燈具。`npm run typecheck` 通過。`npm test` 446 通過，其中「street-lamp heads follow the same lampsOn flag as the avenue」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8239/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 路燈燈柱擋人（本輪）

來源 `5eb28d7` 接到 `e59d9c52`。巡禮折線、碰撞和美術文件衝突。車阻缺口、圖書館坡道和路燈燈頭留著。閃避穿柱那一筆還沒有接。檢查點的靜態產物改成這棵樹的 `AdventureApp-5RJ8Cyy1.js`。測試數從 446 變成 447。

五十九根路燈的燈柱和網格用同一組座標，直徑 0.18 m。半徑 0.42 m 站在柱心會被推開。柱旁 1.2 m、主巡禮和三條折線的轉折點不被推開。三條折線在廣場北側先回到中線。圖書館折線和主巡禮從海豚到書卷時走路燈東側。`npm run typecheck` 通過。`npm test` 447 通過，其中「street-lamp poles stop a body and the pilgrimage lines stay open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8240/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。第一次瀏覽器在存檔重載時遇到環境 I/O，重跑同一站通過。

## 閃避不穿路燈燈柱（本輪）

來源 `39e2dbb` 接到 `867cdde0`。玩家移動和美術文件衝突。室內仍走房間步伐。室外閃避改成 0.2 m 的小步。掃掠把燈柱算進去。路燈燈頭、宮燈教室鏡頭和車阻缺口留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-Dbbs5cLF.js`。測試數從 447 變成 448。

一整步 13/24 m 會跳過柱心附近的燈柱。拆成不超過 0.2 m 的小步之後，身體停在靠近的一側。從柱西 1 m 往東掃 2 m 也會停在柱前。`npm run typecheck` 通過。`npm test` 448 通過，其中「a dodge step and a sweep both stop on the near side of a lamp pole」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8241/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 點名樹幹擋人（本輪）

來源 `07379b70` 接到 `1b27d008`。碰撞、植栽和美術文件衝突。路燈燈柱、閃避小步和車阻缺口留著。樹幹跟燈柱一樣留在 `COLLIDERS` 外面，註冊之後才參加推開。灌木和遠景散佈的樹沒有樹幹。檢查點的靜態產物改成這棵樹的 `AdventureApp-Bd0yGuF3.js`。測試數從 448 變成 449。

134 棵點名的樹有樹幹，底部半徑跟模型同一組數字。榕樹底部半徑 0.52。灌木沒有樹幹。半徑 0.42 m 站在坡底榕樹樹心會被推開。樹西 1.6 m、主巡禮和三條折線的轉折點不被推開。估計路網的中線也不被樹幹推開。`npm run typecheck` 通過。`npm test` 449 通過，其中「specimen trunks stop a body and the pilgrimage lines stay open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8242/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。

## 閃避不穿樹幹（本輪）

來源 `2b50ea05` 接到 `64b73fa2`。掃掠和碰撞註解衝突。室內房間步伐、路燈燈柱和 0.2 m 的閃避小步留著。掃掠現在同時算燈柱和樹幹。靜態產物仍是 `AdventureApp-Bd0yGuF3.js`，所以沒有重跑跨系統路線。測試數從 449 變成 450。

(-8.5, -210) 那棵棕櫚，從西面接觸點一次走 1.04 m 會被推到東面。拆成 0.2 m 的小步後停在西面。掃掠會撞上，終點留在樹心以西。`npm run typecheck` 通過。`npm test` 450 通過，其中「an 80 ms dodge and a sweep both stop on the near side of a trunk」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

上一輪瀏覽器 `http://127.0.0.1:8242/` 的跨系統路線仍算數：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。

## 校門門柱擋人（本輪）

來源 `f8696f0c` 接到 `08b97834`。碰撞、地標和截圖腳本衝突。坡底入口門柱、車阻、路燈燈柱、樹幹和 0.2 m 的閃避小步留著。水源街校門兩根門柱寫進 `COLLIDERS`，和招牌網格用同一組座標。室內仍走房間步伐。檢查點的靜態產物改成這棵樹的 `AdventureApp-JPvLtEAH.js`。測試數從 450 變成 451。

兩根門柱各寬 1 m。半徑 0.42 m 站在西側柱心會被推開。門洞中線、主巡禮和三條折線的轉折點不被推開。一次走 1.04 m 會跳過西側門柱。拆成 0.2 m 的小步後停在靠近的一側。掃掠會碰到門柱。`npm run typecheck` 通過。`npm test` 451 通過，其中「the campus gate piers stop a body and the opening stays open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8243/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `J033uAXZzb9mnngNee0ndcv7HkGuLLEo`。

## 帶字路牌擋人（本輪）

來源 `23614a9a` 接到 `c4397cd3`。碰撞、地標、招牌和截圖腳本衝突。校門門柱、坡底入口門柱、車阻、路燈燈柱、樹幹和 0.2 m 的閃避小步留著。五塊帶字路牌寫進 `COLLIDERS`，和招牌網格用同一組座標。室內仍走房間步伐。檢查點的靜態產物改成這棵樹的 `AdventureApp-Bi9fH_nk.js`。測試數從 451 變成 452。

五塊路牌轉過的角度展開成軸對齊的盒子。半徑 0.42 m 站在坡底「克難坡」牌心會被推開。牌西 1.2 m、主巡禮和三條折線的轉折點不被推開。一次走 1.04 m 會跳過牌子。拆成 0.2 m 的小步後停在靠近的一側。掃掠會碰到牌子。坡底東側一株灌木往北挪了 0.25 m。`npm run typecheck` 通過。`npm test` 452 通過，其中「named boards stop a body and the pilgrimage lines stay open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8244/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `ymW39TOHNN59NjYzojfIWVXIOvhmaiEi`。

## 圖書館台基擋人（本輪）

來源 `e59376ac` 接到 `60dc2401`。碰撞和圖書館模型衝突。帶字路牌、校門門柱、坡底入口門柱、車阻、路燈燈柱、樹幹、坡道欄杆和 0.2 m 的閃避小步留著。台基裙邊寫進 `COLLIDERS`，和模型用同一個 2.5 m 外伸。南緣給坡道留了缺口。閱讀的女孩座位留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-DWCTDco5.js`。測試數從 452 變成 453。

台基高 1.1 m。半徑 0.42 m 站在南緣會被推開。南緣外側 1.2 m 不被推開。坡道中線和左右各 0.5 m、主巡禮和三條折線的轉折點不被推開。`npm run typecheck` 通過。`npm test` 453 通過，其中「the library plinth skirt stops a body and the ramp gap stays open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8245/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `Ge02cvWOfJmYBfG2ctvO7rpz3ORri1dR`。

## 減少動態時風停（本輪）

來源 `427b2489` 接到 `be4e1d67`。風的步進和截圖腳本衝突。圖書館台基、帶字路牌、校門門柱、路燈、樹幹和雨絲停住留著。減少動態時不再推進風的時鐘，風力收到 0。恢復一般動態後白天風力回到 1。檢查點的靜態產物改成這棵樹的 `AdventureApp-Dvwl2Lu9.js`。測試數從 453 變成 454。

風力從 1 開始，減少動態走 40 步後低於 0.02，時鐘停在原值。恢復一般動態後白天風力回到 0.8 以上，時鐘繼續走。`npm run typecheck` 通過。`npm test` 454 通過，其中「reduced motion stills the wind and a normal day brings it back」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8246/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `Y1ykQf8TRUaVRUZqmjpQyq1sNIeQjKrG`。

## 減少動態時河與雲停（本輪）

來源 `0dd53a5c` 接到 `8f7171d2`。河面、雲的步進和截圖腳本衝突。樹和草的風停、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。減少動態時河面的時間不再往前走，雲場也不再漂移。天色、霧和太陽方向仍會跟著時段慢慢換。檢查點的靜態產物改成這棵樹的 `AdventureApp-BT8g_KwQ.js`。測試數從 454 變成 455。

減少動態時河面時鐘停在原值，雲的漂移也停住。一般動態時河面時間會加，雲每秒移 1.6 m，到 1600 m 後繞回。`npm run typecheck` 通過。`npm test` 455 通過，其中「reduced motion holds the river clock and the cloud drift」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8247/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `sGQUSsHC8fFXY3IQXhVa7OzlLS86cv7o`。

## 減少動態時標題鏡頭停（本輪）

來源 `119f5c3f` 接到 `7072bb86`。標題鏡頭和截圖腳本衝突。室內鏡頭、河面、雲、樹和草的風停留著。減少動態時標題鏡頭固定在 (-13, 31.5, 13)。一般動態仍會慢慢繞。鏡頭中心附近沒有樹冠。檢查點的靜態產物改成這棵樹的 `AdventureApp-Bn-oucxD.js`。測試數從 455 變成 456。

減少動態時標題鏡頭停在軌道中心。時間 0 的一般動態，x 仍是 -13，z 是 14.8。時間 10 的一般動態，x 和 z 都離開中心。`npm run typecheck` 通過。`npm test` 456 通過，其中「reduced motion holds the title camera on the orbit centre」和「the title camera is not inside a plaza canopy」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8248/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `Ozlr3Wg9NlweNLsnrQuhHABzNjJPmmi9`。

## 吊飾停住（本輪）

來源 `06507f79` 接到 `3f928b55`。髮尾、吊飾和截圖腳本衝突。標題鏡頭、河面、雲、樹和草的風停留著。減少動態時髮尾和小龜的目標都是 0。已經晃開的彈簧會回到原位。普通移動仍會讓吊飾跟著身體速度擺。檢查點的靜態產物改成這棵樹的 `AdventureApp-DQ-WLzuq.js`。測試數從 456 變成 457。

減少動態時髮尾和小龜的目標都是 0。吊飾從 0.45 經過阻尼後回到 0.02 以內。普通向前速度仍把髮尾帶離 0。`npm run typecheck` 通過。`npm test` 457 通過，其中「reduced motion rests the hair tail and the turtle charm」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8249/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `bBJtLEfIwDkneLQUDBBScvoNfgX9qNzC`。

## 牧羊草坪雕塑（本輪）

來源 `622a00ba` 接到 `748943d7`。碰撞、地標和截圖腳本衝突。吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。1.6 m 石座會擋住半徑 0.42 m 的身體。蓋章點在石座南邊，沒有被推進碰撞。巡禮折線不經過石座。檢查點的靜態產物改成這棵樹的 `AdventureApp-BxrhL8s3.js`。測試數從 457 變成 458。

石座中心會把人推開。蓋章點留在草地上。一次 1.04 m 的位移不會穿到石座北側。`npm run typecheck` 通過。`npm test` 458 通過，其中「the meadow figure blocks the body and leaves the stamp on the grass」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8250/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `IqRhqIU4eM1wRoDrWvbEPI8DaBGUft1v`。

## 五虎碑（本輪）

來源 `04fb8bac` 接到 `93a52000`。碰撞、地標、世界和截圖腳本衝突。牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。3.2 m 石座會擋住半徑 0.42 m 的身體。蓋章點在石座北邊，沒有被推進碰撞。巡禮折線不經過石座。石座不跨過館牆。檢查點的靜態產物改成這棵樹的 `AdventureApp-MMYJCgLt.js`。測試數從 458 變成 459。

石座中心會把人推開。蓋章點留在北側草地。一次 1.04 m 的位移不會穿到石座南側。`npm run typecheck` 通過。`npm test` 459 通過，其中「the five-tigers stele blocks the body and leaves the stamp on open grass」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8251/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `2Vi9nVI37qwPSnVIoIS9ivBlMy3pxrmH`。

## 舷側展示機（本輪）

來源 `2e07ebe2` 接到 `3db5283e`。碰撞、世界和截圖腳本衝突。五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。兩架展示機的機身會擋住半徑 0.42 m 的身體。南門留在館外。巡禮折線不經過機身。旋翼不轉。檢查點的靜態產物改成這棵樹的 `AdventureApp-DtWg8jon.js`。測試數從 459 變成 460。

機身中心會把人推開。南門仍走得過。一次 1.04 m 的位移不會穿到機身另一側。`npm run typecheck` 通過。`npm test` 460 通過，其中「museum airframes block the body and leave the south door open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8252/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `zPUHyjWs2Reo6R8vyV7x0EUlSGRUBwSo`。

## 籃架底座（本輪）

來源 `c3698975` 接到 `1c9fdf94`。截圖腳本衝突。室內行走現在把運動主題的底座交給同一步進，教室仍不帶底座。展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。1.4 m 底座會擋住半徑 0.42 m 的身體。南門仍站得住。檢查點的靜態產物改成這棵樹的 `AdventureApp--EkMv-EO.js`。測試數從 460 變成 461。

活動室裡站在東側籃架中心會被推開。教室裡同一點不會被底座推開。從西緣往東跨 1.04 m 仍停在中心西側。`npm run typecheck` 通過。`npm test` 461 通過，其中「activity-room hoop bases stop a body and leave the classroom open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8253/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。第一次跑到戰鬥後遇到一次檔案關閉錯誤，重跑通過。登入的使用者是 `RG4N8NZxm7t4gSBzFzwV6l0VftkEGxLB`。

## 籃架留在房內（本輪）

來源 `2ee4ec18` 接到 `9e12bb2d`。美術文件衝突。底座、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。貼著房間邊界撞上底座時，人留在牆內，也不留在底座裡。教室裡同一點不會被推開。南門仍站得住。檢查點的靜態產物改成這棵樹的 `AdventureApp-DG8LvEb7.js`。測試數仍是 461，同一支測試多了牆邊的斷言。

貼著東牆和西牆撞上底座時，座標留在房間範圍內。`npm run typecheck` 通過。`npm test` 461 通過，其中「activity-room hoop bases stop a body and leave the classroom open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8254/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `ZR6KBQIz0z9QVU0bg2Iyv12UqabFOwEP`。

## 教室講台（本輪）

來源 `e79fbbf0` 接到 `c63315a8`。室內規則、講台和截圖腳本衝突。籃架底座的牆邊停留、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。1.6×1.3 m 的講台會擋住半徑 0.42 m 的身體。閱讀室同一點不會被推開。南門仍站得住。室內行走只在宮燈教室帶上講台。檢查點的靜態產物改成這棵樹的 `AdventureApp-C3w3A_cl.js`。測試數從 461 變成 462。

宮燈教室裡站在講台中心會被推開。閱讀室同一點不會被推開。從南緣往北跨 1.04 m 仍停在中心南側。講台和最近的學生桌分開。`npm run typecheck` 通過。`npm test` 462 通過，其中「the palace desk stops a body and leaves the reading room and the door open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8255/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `TXevUasWOdbaYfVE9yLczPRDpyz0NJMc`。

## 閱覽桌（本輪）

來源 `64f336ca` 接到 `3c4100a4`。室內規則、閱覽桌和截圖腳本衝突。講台、籃架底座的牆邊停留、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。兩座 1.4×1.3 m 的閱覽桌會擋住半徑 0.42 m 的身體。中間走道留著。教室同一點不會被推開。南門仍站得住。推出方向若會出房間就改走另一軸。室內行走只在閱讀室帶上這兩座桌子。檢查點的靜態產物改成這棵樹的 `AdventureApp-TAFS6WHn.js`。測試數從 462 變成 463。

閱讀室裡站在東側閱覽桌中心會被推開。教室同一點不會被推開。中間走道和南門不被推開。從南緣往北跨 1.04 m 仍停在中心南側，人也留在房間裡。閱覽桌和學生桌分開。`npm run typecheck` 通過。`npm test` 463 通過，其中「reading carrels stop a body and leave the classroom aisle open」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8256/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `e79FX5h7KPpUlrUquU6FBWTMUBVFCpK2`。

## 書架讓位（本輪）

來源 `bf82dc53` 接到 `0a448897`。書架位置和截圖腳本衝突。閱覽桌、講台、籃架底座的牆邊停留、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。層板內緣在 9.06，書本內緣在 9.18，都在身體最外緣 9 和牆內面 9.45 之間。人站在房間側邊不會穿進書架。檢查點的靜態產物改成這棵樹的 `AdventureApp-BvroPXjo.js`。測試數從 463 變成 464。

層板和書本都沒有伸進身體能站的範圍，也沒有伸進牆裡。`npm run typecheck` 通過。`npm test` 464 通過，其中「reading-room shelves sit between the body and the wall」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8257/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `uSrLXvIS834krHtHdYly13SO1aoyHM5f`。

## 前庭石座（本輪）

來源 `44bf4c9f` 接到 `3642c769`。石座、碰撞和截圖腳本衝突。來源把石座放在坡道中線，這裡改放在已接上的西側長椅，所以坡道仍走得過。書架、閱覽桌、講台、籃架底座的牆邊停留、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。1.4 m 石座會擋住半徑 0.42 m 的身體。低畫質也看得到她。檢查點的靜態產物改成這棵樹的 `AdventureApp-C3lU_aFC.js`。測試數從 464 變成 465。

石座中心會把人推開。從南緣往北跨 1.04 m 仍停在中心南側。坡道缺口不被推開。巡禮折線不經過石座。`npm run typecheck` 通過。`npm test` 465 通過，其中「the reading girl sits on a forecourt seat that stops a body」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8258/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `GPc3ltvmnoJI1Ubp8prsZJ1FpikOgQJo`。

## 體育館夜窗（本輪）

來源 `c3ce7704` 接到 `6dabb15e`。截圖腳本和美術文件衝突。高側窗用和大道相同的暖色，白天不發光。前庭石座、書架、閱覽桌、講台、籃架底座的牆邊停留、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-D_74TDC1.js`。測試數從 465 變成 466。

路燈關掉時高側窗 emissive 是 `#000000`、強度 0。路燈亮時是 `#ffe6b4`、強度 0.55。`npm run typecheck` 通過。`npm test` 466 通過，其中「the gym clerestory is dark by day and warm when the lamps are on」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8259/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `VUQlCbiXkDgOMRtQ2mNquUpuRI8hyOsf`。

## 書卷四字（本輪）

來源 `5fe60b19` 接到 `ed9a2f99`。截圖腳本和美術文件衝突。四片書卷的位置沒有改，字牌朝廣場中心，留在既有 3 m 碰撞盒裡。體育館夜窗、前庭石座、書架、閱覽桌、講台、籃架底座的牆邊停留、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-BAb1q8mR.js`。測試數從 466 變成 467。

字依序是樸、實、剛、毅。每張字牌離自己那片書卷的中心不到 1.5 m，也比書卷更靠近廣場中心。沒有新增碰撞。`npm run typecheck` 通過。`npm test` 467 通過，其中「each scroll blade carries one character of 樸實剛毅 inside its box」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8260/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `6OH5zQnDdV6eihUicfRq6wUyhj5XdVJR`。

## 海豚勉詞（本輪）

來源 `5c3589bc` 接到 `9cb2412e`。截圖腳本和美術文件衝突。基座南面從一行改成兩行，牌子加高到 0.72 m，仍貼在既有石座上。書卷四字、體育館夜窗、前庭石座、書架、閱覽桌、講台、籃架底座的牆邊停留、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-BVZUqW2H.js`。測試數從 467 變成 468。

兩行是「立足淡江，放眼世界」和「掌握資訊，開創未來」。沒有新增碰撞。`npm run typecheck` 通過。`npm test` 468 通過，其中「the dolphin plinth carries all four phrases on two lines」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8261/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `U72OoCev8zYYiUXvjHPon7zHgslBgEn6`。

## 游泳館夜窗（本輪）

來源 `683baba3` 接到 `1cff5f45`。截圖腳本和美術文件衝突。南向高窗白天不發光，路燈亮起時用冷水色 `#9fd8e2`、強度 0.62。體育館暖色高窗、海豚勉詞、書卷四字、前庭石座、書架、閱覽桌、講台、籃架底座的牆邊停留、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-CwdvnRUc.js`。測試數從 468 變成 469。

白天高窗發光色是 `#000000`、強度 0。路燈亮起時不是大道燈的暖色。沒有新增碰撞。`npm run typecheck` 通過。`npm test` 469 通過，其中「the pool hall glass is dark by day and cool when the lamps are on」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8262/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `D5ZFGQ32u1WilxIENWF53mZ9P1GW7VZC`。

## 活動室球場（本輪）

來源 `5511da85` 接到 `c9222b3c`。截圖腳本、室內版面和美術文件衝突。活動室有 10 條標線：兩條邊線、兩條底線、兩側禁區。底線在籃框 x=7.5 和籃架 x=8 之間。每條線高度低於 0.1 m，不擋人。籃架底座、游泳館冷色高窗、體育館暖色高窗、海豚勉詞、書卷四字、前庭石座、書架、閱覽桌、講台、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。宮燈教室和閱讀室沒有這組線。檢查點的靜態產物改成這棵樹的 `AdventureApp-mX9WK04L.js`。測試數從 469 變成 470。

`npm run typecheck` 通過。`npm test` 470 通過，其中「the activity room paints a court between the hoops」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8263/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `G5bm20BkK329Oa50iOFlgyBqigLUphup`。

## 活動室一組標線（本輪）

來源 `f4e9fae3` 接到 `82912ea4`。室內細節和美術文件衝突。活動室地板只畫一組標線，共 11 條。舊的牆邊 x=±8.5、z=±5.5 那組已拿掉。底線在籃框 x=7.5 和籃架 x=8 之間。每條線高度低於 0.1 m，不擋人。籃架底座、游泳館冷色高窗、體育館暖色高窗、海豚勉詞、書卷四字、前庭石座、書架、閱覽桌、講台、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。宮燈教室和閱讀室沒有這組線。檢查點的靜態產物改成這棵樹的 `AdventureApp-BeLoy1Vt.js`。測試數仍是 470，同一支測試多檢查舊線已消失。

`npm run typecheck` 通過。`npm test` 470 通過，其中「the activity room paints a court between the hoops」涵蓋 11 條和舊線不在。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8264/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `gumoFJn4coKH8FK6RaqniOe6ywFHtZEx`。

## 游泳館水道（本輪）

來源 `26a70194` 接到 `1ad674cc`，走路停在池邊是 `e0c145a5`。截圖腳本、室內碰撞和美術文件衝突。水面是最後一個碰撞參數，籃架底座、講台、閱覽桌和學生桌的參數沒有移位。游泳館從南邊走進去會停在水面外。體育館中心仍留在原地，籃架底座仍會擋人。分道線和六座出發台不另設碰撞。活動室仍是一組 11 條地板標線。游泳館冷色高窗、體育館暖色高窗、海豚勉詞、書卷四字、前庭石座、書架、閱覽桌、講台、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-DaP6TsRc.js`。測試數從 470 變成 471。

水面 12.4×8 m。五條分道線在水面內，六座出發台在西端池邊外。南邊甲板 z=5.2 和南門 z=6.4 不被推開。`npm run typecheck` 通過。`npm test` 471 通過，其中「the swimming hall keeps a body on the deck」涵蓋這項。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8265/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `wuSLNBsKYcGyjTUW6VRMeW3OJSgQBTVe`。這筆已在整合 PR #340。

## 游泳館甲板（本輪）

來源 `6ae3b4fb` 接到 `44930d45`。美術文件和水道測試衝突。進門和讀回存檔共用同一個出生點。游泳館是南邊甲板 z=5.2，體育館和宮燈教室仍是 z=4。這個點在水面外，不會被推進水裡。人再往前走仍停在池邊。分道線和出發台不擋人。籃架底座和一組地板標線留著。游泳館冷色高窗、體育館暖色高窗、海豚勉詞、書卷四字、前庭石座、書架、閱覽桌、講台、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-xeUx5bPQ.js`。測試數仍是 471，同一支測試多檢查出生點。

`npm run typecheck` 通過。`npm test` 471 通過，其中「the swimming hall keeps a body on the deck」涵蓋出生點和水面。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8266/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `0Dhj0hWA6KV3wbAf2PIFriYQOjuTjxBZ`。這筆已在整合 PR #341。

## 手機畫面（本輪）

來源 `d74acab2` 接到 `5b0adafe`。沒有衝突。窄螢幕時上方選單改放到量過的觸控位置，不蓋住搖桿、視線區和小地圖。快捷列偏好寬度從 96 收到 56，不再佔滿左側。雲端同步在短邊不超過 500 時收成右上角的「雲端」，打開後是一塊實心底紙。寬螢幕仍是原來的面板。學期開始的提示改成畫面上的普攻、技能和閃避。進游泳館或讀回存檔仍站在南邊甲板 z=5.2。水面、籃架和一組地板標線留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-BsHSlZPF.js`。測試數仍是 471。

`npm run typecheck` 通過。`npm test` 471 通過。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8267/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `elmIVHDd7q3tQNIwiEIp2pa31h839tmZ`。這筆已在整合 PR #342。

## 黑天鵝（本輪）

來源 `e149387c` 接到 `92c8d0de`。室內碰撞、截圖腳本和美術文件衝突。台座是最後一個碰撞參數，排在籃架底座、講台、閱覽桌和水面之後。走路的一步也帶這個參數。海事博物館台心會被推到台外，北緣仍在房間裡。南門 (0, 6.4) 不被推開。閱讀室同一點留在原地。窄螢幕的選單仍不蓋住搖桿。進游泳館仍站在南邊甲板 z=5.2。籃架、講台、閱覽桌、水面、一組地板標線、游泳館冷色高窗、體育館暖色高窗、海豚勉詞、書卷四字、前庭石座、書架、展示機、五虎碑、牧羊草坪的立姿、吊飾停住、標題鏡頭、河面、雲、圖書館台基、帶字路牌、校門門柱、路燈和樹幹留著。檢查點的靜態產物改成這棵樹的 `AdventureApp-DwSeymN1.js`。測試數從 471 變成 472。

台座在 (0, -5.3)，邊長 1.4 m。`npm run typecheck` 通過。`npm test` 472 通過，其中「the museum swan keeps a body on the floor and inside the room」涵蓋台心、南門、閱讀室和走一步。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8268/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `sE9YGkso9z6CwEZMm5rB0ayY4BwJHTk7`。這筆已在整合 PR #343。

## 終點線（本輪）

來源 `7f328f22` 接到 `b5d90256`。截圖腳本和美術文件衝突。終點線畫在田徑場南直道，軸向是 Z，x=0，長度等於跑道內外緣的差。整條線落在跑道帶上，不在內圈橢圓裡，沒有球網，也不擋人。內圈仍是 5 條線。太小的場不畫。黑天鵝台座留著。進游泳館仍站在南邊甲板 z=5.2。窄螢幕的選單仍不蓋住搖桿。檢查點的靜態產物改成這棵樹的 `AdventureApp-2QhLNbtj.js`。測試數從 472 變成 473。

`npm run typecheck` 通過。`npm test` 473 通過，其中「the track finish stripe crosses the south straight」涵蓋這條線。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8269/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `0aY8qQpnyVo6Hw6Bu4yBISc5EsqLSvwf`。這筆已在整合 PR #344。

## 沙坑（本輪）

來源 `4310e4c1` 接到 `f238493c`。截圖腳本、標線測試和美術文件衝突。沙坑畫在內圈東側，3×8 m，西端有一塊起跳板。四個角都在跑道內緣橢圓裡，西緣在白線外側。沙面可以走過去，沒有碰撞。南直道終點線留著。內圈仍是 5 條線。太小的場不畫。黑天鵝台座留著。進游泳館仍站在南邊甲板 z=5.2。窄螢幕的選單仍不蓋住搖桿。檢查點的靜態產物改成這棵樹的 `AdventureApp-qujPokkI.js`。測試數從 473 變成 474。

`npm run typecheck` 通過。`npm test` 474 通過，其中「the sand pit sits on the grass beside the pitch」涵蓋這座沙坑。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8270/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `msVF0AwA9IjSNCBopHQSmxMJUfEhfx0g`。這筆已在整合 PR #345。

## 斑馬線（本輪）

來源 `13baaacf` 接到 `9c89e653`。截圖腳本和美術文件衝突。坡底鋪面有六條白線，夾在兩根門柱中間。南緣不到門口線，也離坡底車阻超過 0.8 m。線是平塗，沒有碰撞。沙坑留著。南直道終點線留著。黑天鵝台座留著。進游泳館仍站在南邊甲板 z=5.2。窄螢幕的選單仍不蓋住搖桿。檢查點的靜態產物改成這棵樹的 `AdventureApp-CD48jCI7.js`。測試數從 474 變成 475。

`npm run typecheck` 通過。`npm test` 475 通過，其中「the gate zebra stays on the apron between the piers」涵蓋這六條線。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8271/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `zbTSfhM21wH4tSmF0s7FUZxUItjFouT2`。這筆已在整合 PR #346。

## 公告牌（本輪）

來源 `9ba62780` 接到 `f747150b`。截圖腳本和美術文件衝突。四座公告牌共用兩行字：校園公告、請沿步道行走。每行 2 到 8 個字。牌架沒有改，也沒有加碰撞。坡底斑馬線留著。沙坑留著。南直道終點線留著。黑天鵝台座留著。進游泳館仍站在南邊甲板 z=5.2。窄螢幕的選單仍不蓋住搖桿。檢查點的靜態產物改成這棵樹的 `AdventureApp-CT5hhyI6.js`。測試數從 475 變成 476。

`npm run typecheck` 通過。`npm test` 476 通過，其中「every notice board shares two short lines」涵蓋這兩行字。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8272/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `ycHJlcf7UDBydU1qQ5DXdoLvnG8wJlN9`。這筆已在整合 PR #347。

## 學生遇上（本輪）

來源 `7c65c1b5` 接到 `c3174c67`。沒有衝突。點名、坡道積水和發傳單各有兩種配置，人不會追過來。點名要站到被點的那一格，連續錯過兩次就失敗，打也不掉血。積水沿坡上來，走到屋簷才停。傳單走固定路線，走到門即可。走錯路或修錯可以改兩次，第三次才失敗。戰鬥文字會寫出還能不能打斷。獎勵仍走既有的任務結算。公告牌的兩行字留著。坡底斑馬線留著。進游泳館仍站在南邊甲板 z=5.2。窄螢幕的選單仍不蓋住搖桿。測試數從 476 變成 479。

`npm run typecheck` 通過。`npm test` 479 通過，其中「roll call, hillside rain, and club flyers are different from the four chases」和「a wrong route or repair can be edited before the third miss」涵蓋這一批。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8273/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `FMYrJ5z82Dj1Kwsr1hjajYcoNElF3Cha`。這筆已在整合 PR #348。

## 檢查點（本輪）

來源 `3270f9f8` 接到 `d3767787`。沒有衝突。多樣遭遇的檢查點 `head` 從 `a2bb9643` 改成 `7c65c1b5`。點名、坡道積水和發傳單的玩法沒有改。公告牌的兩行字留著。坡底斑馬線留著。進游泳館仍站在南邊甲板 z=5.2。靜態產物仍是 `AdventureApp-BMQlCBWh.js`，雜湊和整合 PR #348 相同，所以沒有重跑跨系統路線。

`npm run typecheck` 通過。`npm test` 479 通過。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

上一輪路線 `http://127.0.0.1:8273/` 仍算數：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。登入的使用者是 `FMYrJ5z82Dj1Kwsr1hjajYcoNElF3Cha`。這筆已在整合 PR #349。

## 背包變大（本輪）

來源 `bd2e531c` 接到 `c1de390e`，雲端白名單修正是 `3f660c29`。`contract.ts` 和 `store.ts` 衝突。保留採集鍵上限、文件鍵上限，以及匯入時遭遇寫入失敗仍標成錯誤。槽位上限從 24 改成 36。`pockets` 放進雲端白名單，只收 0 到 8。沒有這個欄位的舊存檔仍可上傳。起步仍是 24 格。穿上野外背包多 4 格，脫下不刪物品。補給站花 2 份布縫口袋，每次多 4 格，最多再 8 格。路障在 2.4 公尺內，血量至少 140 減傷加 4，否則加 2，只計一次。點名、積水和傳單仍不會追人。公告牌的兩行字留著。進游泳館仍站在南邊甲板 z=5.2。窄螢幕的選單仍不蓋住搖桿。測試數從 479 變成 480。

`npm run typecheck` 通過。`npm test` 480 通過，其中「the same bag grows by a worn pack or sewn pockets, and cover stacks once」涵蓋背包和路障。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

瀏覽器 `http://127.0.0.1:8274/`。同一站跨系統路線通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。靜態產物換了，所以重跑這條路線。登入的使用者是 `VOJyD3dq0jx25cln1a3j4m8cllWqnjzF`。這筆已在整合 PR #350。

## 商管大樓（本輪）

來源 `15991ca7` 接到 `41cc456b`。`ContextStructures.tsx` 的教育館雨遮和商管樓身撞在同一段，兩邊都留下。行政大樓的說明改回到 `officeProfile` 上面。商管大樓是 business-hall：深色玻璃底座、退縮的淺色樓身、兩條橫帶。行政大樓仍是 office-block。外形是 estimated。

`npm run typecheck` 通過。`npm test` 481 通過。靜態產物是 `AdventureApp-Bh01Fzf9.js`，雜湊 `8b0319f2683840a234f547ab2130b494730f6dd084f64405f6badd86519cde15`。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

跨系統路線 `http://127.0.0.1:8275/` 通過：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。登入的使用者是 `Y6iTr0J76468VLbzpWviPi1BzNUecEhs`。這筆還沒有上 main。

## 道具記錄（上一輪）

來源 `731c7c9a` 接到 `4400e510`，白名單註記是 `312d03e0`。沒有衝突。道具線的記錄改指向 `bd2e531c`：起步 24 格，田野背包穿上加 4 格，縫口袋最多再 8 格，路障在 2.4 公尺內減傷。玩法沒有改。六個存檔鍵已在雲端白名單，所以記錄不再把白名單當成還沒做。靜態產物仍是 `AdventureApp-CroGWghJ.js`，雜湊和整合 PR #350 相同，所以沒有重跑跨系統路線。

`npm run typecheck` 通過。`npm test` 480 通過。`dist/assets` 沒有 `cloud-save` 或 `DATABASE_URL`。

上一輪路線 `http://127.0.0.1:8274/` 仍算數：大門經驗 20、筆記 19；補給後經驗 44、筆記 21、學期期中；390×780 的窄畫面仍讀到「期中 · 擊退三隻異象」；突襲小考 65→45、經驗停在 44；存檔重載經驗 44、筆記 21、科系 `science-理學院-2`；revision 1；第二客戶端看到期中；同時上傳時較早落地的那一邊是經驗加 3，所以雲端經驗是 47；斷線的加 1 留在佇列；登出 401。`pageErrors` 空。幀時間是 SwiftShader。登入的使用者是 `VOJyD3dq0jx25cln1a3j4m8cllWqnjzF`。這筆已在整合 PR #351。

## 本輪沒有驗的項目

- 手機與真機上的雲端面板點擊。本輪在 Node 開發頁讀到面板文字，沒有在手機上操作
- 內容版本不相容
- 行走中的 NPC 套件特寫、非工程學院技能逐一截圖
- 手機與 RTX 3060：`pending-device`。不填估計 FPS
- reduced-motion 另拍
- 正式部署
