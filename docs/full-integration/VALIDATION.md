# 統整線驗證

瀏覽器路線所在遊戲提交：`f300327cda2b5829c79eaf9aa1a6fddcb1d57230`（含教職員 `7f6f3c8`、玩法線 `d82bf00`、化學館所在的 `main` `e1f52fd`）。
學期查詢已在 main，整合 PR #125。這次沒有再合。

這些指令是在該工作樹上親自跑的。沒有 CI。沒有 required checks 不算驗收通過。

| 指令 | 結果 |
| --- | --- |
| `npx tsc --noEmit` | 通過。在 `f300327`，衝突只修了敘事面板的 scroll id |
| `npm test` | 304 通過、0 失敗 |
| `npm run build:site` | 通過。2372 個模組。`dist` 沒有 `revision_conflict` 或 `cloud-save` |
| `node --experimental-transform-types scripts/integration-route.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-route` | 通過，exit 0。`pageErrors` 空、離線遊玩時頁面 API 請求空 |
| `npx eslint` 只掃這次改過的檔 | 1 個既有錯誤：`src/game/rpg/AdventureHud.tsx:639` irregular whitespace，不在這次 diff。1 個既有警告：`store.ts` 的 `dirty` 未使用。不把全庫 lint 說成通過 |
| `art:validate` | 沒跑。這次沒有改美術輸出 |

## 主遊戲路線

站點：`http://127.0.0.1:8088/`，`npm run preview:site` 提供剛建好的 `dist`。瀏覽器是 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這不是手機，也不是 RTX 3060。

解析度：1280×720，以及 390×780。390 這一頁是細指標，所以畫面上仍是桌面狀態卡 `.ad-semester`，不是粗指標的 `.tk-mobile-semester`。

步驟與讀數：

- 離線標題，API 請求 0。
- 化學學系，存檔 id `science-理學院-2`，學院 `science`。
- 大門獎勵一次：經驗 20、筆記 19、`claimed` 只有 `quest-orient-gate`。學期仍是 `week-1`。
- 走到第一個補給點。經驗 44：大門 20、站在補給點時既有發現 +12、委託 +12。`claimed` 正好是大門與 `quest-errand-campus-post`。學期 `midterm`。狀態卡文字是「期中 · 擊退三隻異象」。1280 與 390 都是這一行，沒有蓋住底部普攻、技能、閃避與物品鍵。
- 再進大門，面板沒有第二次獎勵，經驗停在 44。`interiorId` 先是 `main-gate`，接著回到 null。
- 一隻 quiz 從 65 到 45，經驗仍是 44。沒有打另外三種怪物。
- 重載：科系 id 不變，經驗 44，筆記 21，委託還在。
- 未登入 `local_only`。登入後 revision 1。第二個 API 客戶端下載到期中存檔。競態 200 與 409，`revision_conflict`，revision 2。離線佇列後雲端經驗 47。登出 401。帳號 id 是測試註冊，不是真人。

畫面檔在 `/opt/cursor/artifacts/integration-route/04b-semester-desktop.png` 與 `04c-semester-narrow.png`。固定畫面不能用來宣稱動畫流暢。沒有重測三角形或幀時間，不沿用 `7507c59` 的數字。

## 同一條路線接著點了建造與徽章

克難坡上的放置提示寫「請保留克難坡通行空間」。按下放置後沒有建物，經驗仍是 44。結束建造後建造模式清空。換到 `validatePlacement` 允許的位置，放下一盞守夜宮燈；同一格再放一次仍只有一盞，經驗仍是 44，委託 id 仍是一筆。窄窗 390×780 的放置、旋轉、結束建造在快捷列上方。建造中的普攻、技能、閃避寫「場景不可用」。

quiz 仍從 65 到 45。接著對既有的 `final-1` 連續使用普攻。路線在每一下之間把攻擊冷卻清掉，沒有把時鐘一次跳 40 秒。勝利對話的「領取獎勵，繼續探索」領取既有的 `semester` 任務，徽章進入背包。背包按鈕是「卸下徽章」。重載後經驗 464、筆記 18（燈花了 3 本筆記）、徽章 1、`equipped` 為真、建物仍是那盞燈、學期仍是 `midterm`。第二個 API 客戶端看到同一份裝備與建物。

同一條路線接著站到估計座標 `(0, -40)`。按鈕「宮燈夜巡」出現，沒有蓋住快捷列。先送錯一組線索，再送對「第三盞的開關是暖的」和「有人把筆記放在第三盞下面」，扳第 1 與第 3 盞燈，護送到傳達桌，按「領取結算」。經驗從 464 到 500，筆記到 22，`claimed` 有 `quest-gv-night-peace`。再按一次經驗不變。學期仍是期中。重載與第二個 API 客戶端都保留這筆。遭遇進行中的記憶鍵是 `tamkang-gameplay-variety-v1`，獎勵寫進 `tamkang-rpg-v2`。

化學系的技能按鈕把 report 從 145 打到 93。exam 從 240 到 211。quiz 與 final 仍是先前那兩下。另外八個學院的技能這輪沒有換科系去打。

同一條路線接著把視窗設回 1280×720，站到建築系館南側估計位置 `(294.8, -74.5)`。世界按鈕是「與顧衡交談」。面板裡再按一次「交談」才出現選項。兩個選項都看得到。選「我先補剖面，補完再請你看。」。結果句是「剖面沒到，我不開始評。你問的是線，我就記你問的是線。」`fac-gu-meet-line` 為真，`fac-gu-meet-fail` 為假。`claimed` 增加 `quest-faculty-gu-meet` 與 `quest-faculty-studio-meet`。選項當下經驗從 512 到 534。站上這個崗位時，既有地點發現把 `architecture` 寫進 `discoveries`，那是夜巡後 500 與選項前 512 之間的 12 點。筆記仍是 22。學期仍是期中。重載後這些都還在。第二個 API 客戶端的遠端文件有 `quest-faculty-gu-meet`，而且 `narrative.flags["fac-gu-meet-line"]` 為真。之後的競態仍是 200 與 409，離線佇列後雲端經驗 537，登出 401。測試註冊 id 是 `OjqQ7D5d6cGVr8i0CTggZhLfi5ijYquF`，不是真人。

同一條路線接著再拿一箱含銅線圈的補給，放下研究桌，站在桌旁打開背包。製作「修復扳手」普通品質，再按詳情裡的「裝備」。提示是「已裝備修復扳手。」按鈕變成「卸下」。主工具是 `repair-wrench`，耐久 48，配件仍是 `badge`。研究桌花了 4 本筆記，所以筆記從 22 到 18。重載後經驗 546、建物是宮燈和研究桌、兩個槽都還在。第二個 API 客戶端看到同一份 `loadout` 與普通扳手。雲端文件現在會拒絕裝備欄上的額外欄位；沒有這些欄位的舊存檔仍可通過。內容版本仍是 2。

同一條路線在扳手之後打開學期委託。第一堂異象課是 1/3，領取鈕停用，狀態仍是期中。接著用既有普攻擊倒 quiz-2 與 quiz-1，擊退數到 3，學期仍是期中。按下「領取獎勵」後 `claimed` 有一筆 `first`，經驗從領取前加 60 到 666，狀態文字是「期末 · 委託已結算」。按鈕變成停用的「已領取」。再呼叫一次 `claim("first")` 經驗不變。重載經驗 666、筆記 18。第二客戶端的學期是 `finals`。競態仍是 200 與 409，離線後雲端經驗 669，登出 401。`npm test` 這輪是 307 通過、0 失敗。

同一條路線在顧衡之前先站到鍾靈化學館南側的估計位置，按「與沈酌交談」。面板沒有打開。提示是「這位現在沒有新的話說。上一件事還沒完成，或這段已經談完。」經驗停在 512，那 12 點是走到化學館時既有地點發現，不是這句話發的。接著顧衡仍可選補剖面，經驗到 546。重載後經驗 558、筆記 18，扳手和研究桌都還在。第二客戶端、409 衝突和登出 401 仍通過。`npm test` 這輪是 306 通過、0 失敗。

失敗那一版的選項出現在畫面上，這次沒有點。那個結果句與「選了之後再選另一個不會再發獎」是 `scripts/faculty-story.test.mjs` 的斷言，不是第二次瀏覽器遊玩。

## 九學院技能

這段是另一次瀏覽器執行，不是把上面那條期末路線再跑一遍。

| 指令 | 結果 |
| --- | --- |
| `npx tsc --noEmit` | 通過。工作樹是 `fbefee8` 加上尚未提交的 `scripts/integration-colleges.mjs` |
| `npm test` | 310 通過、0 失敗。含 `scripts/library-ramp.test.mjs` 與 `scripts/cloud-gear-contract.test.mjs` |
| `npm run build:site` | 通過。在坡道合併 `90f906b` 上建出 `AdventureApp-5c63vhYi.js`。`dist` 沒有 `revision_conflict` 或 `cloud-save` |
| `node --experimental-transform-types scripts/integration-colleges.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-colleges` | 通過，exit 0。`pageErrors` 空 |

站點仍是 `http://127.0.0.1:8088/`。解析度 1280×720。瀏覽器 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這不是手機，也不是 RTX 3060。

九次都從標題的搜尋框選科系。QA hook 負責站位與把專注設成 100。quiz-2 從 65 掉到：結構脈衝 25、共振反應 13、敘事解構 31、資源調度 33、多重詠唱 27、知識領域 37、協議共識 30、模型推演 15、復原領域 43。提示都含技能名。建築學系畫面是「結構脈衝 · 命中 1 個目標」、25/65，狀態卡「第一週 · 先問入口方向」。高齡健康管理學研究所是「復原領域 · 命中 1 個目標」、43/65。七區路網與攝影機這輪沒有重走。

畫面檔：`/opt/cursor/artifacts/integration-route/08-faculty-choices.png`、`08b-faculty-line.png`。裝置是這台雲端主機的 headless Chrome，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這不是手機，也不是 RTX 3060。固定畫面不能用來宣稱動畫流暢。沒有重測三角形或幀時間。
