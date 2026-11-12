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

九次都從標題的搜尋框選科系。QA hook 負責站位與把專注設成 100。quiz-2 從 65 掉到：結構脈衝 25、共振反應 13、敘事解構 31、資源調度 33、多重詠唱 27、知識領域 37、協議共識 30、模型推演 15、復原領域 43。提示都含技能名。建築學系畫面是「結構脈衝 · 命中 1 個目標」、25/65，狀態卡「第一週 · 先問入口方向」。高齡健康管理學研究所是「復原領域 · 命中 1 個目標」、43/65。

## 七區路網與跟隨鏡頭

這段打在球場淨空合併 `15fcc9c` 之後的工作樹上。`getCamera` 讓 QA 讀到跟隨鏡頭的位置。遊戲本身不讀它。

| 指令 | 結果 |
| --- | --- |
| `npx tsc --noEmit` | 通過 |
| `npm test` | 311 通過、0 失敗。含 `scripts/court-clearing.test.mjs` |
| `npm run build:site` | 通過。`AdventureApp-LRjQocEU.js`。`dist` 沒有 `revision_conflict` 或 `cloud-save` |
| `node --experimental-transform-types scripts/integration-roads.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-roads` | 通過，exit 0。`pageErrors` 空 |

站點 `http://127.0.0.1:8088/`。瀏覽器 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。1280×720，以及 390×780。390 是細指標，不是粗指標手機 HUD，也不是 RTX 3060。

標題選土木工程學系。校園地圖的圖例有軸線、書圖、理工、教學、文藝、運動、生活。七個估計路點各走 24 幀。桌面移動距離是軸線 1.55、書圖 1.97、理工 1.80、教學 2.12、文藝 2.11、運動 1.92、生活 1.88 公尺。窄窗也全部超過 1.5 公尺。走完後鏡頭水平距離都在 5.09 到 5.12 公尺，高出角色約 2.86 公尺，離標題鏡頭超過 20 公尺。小地圖文字與該區一致。分區是最近建物的區，不是實測界線。這次沒有把每條折線走完。

390×780 的運動區畫面裡，快捷列蓋住角色下半身。小地圖和學期卡的方框沒有跟快捷列重疊。固定畫面不能用來宣稱動畫流暢。沒有重測三角形或幀時間。

## 顧衡的失敗選項

這段是新的一局，打在 `2f7667b` 的靜態建置 `AdventureApp-LRjQocEU.js`。之後 main 前進到雨天球場 `9dd707e`，差異在 `src/game/materials/wet.ts` 與球場材質，沒有改教職員對話，所以沒有把這句再打一次。合併後的檢查是 `npx tsc --noEmit` 通過，`npm test` 312 通過、0 失敗。

| 指令 | 結果 |
| --- | --- |
| `node --experimental-transform-types scripts/integration-gu-fail.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-gu-fail` | 通過，exit 0。`pageErrors` 空 |

站點 `http://127.0.0.1:8088/`。1280×720。瀏覽器 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這不是手機，也不是 RTX 3060。

標題選建築學系。站上估計位置後經驗是 12。點失敗選項後經驗 34，學期 `week-1`，狀態卡仍是「第一週 · 先問入口方向」。結果句是「失敗的那版可以先放上來。你把它帶來，我就不當你在躲。」下一句是「你沒有先藏。裂縫還在。」離開不結算，經驗停在 34。重載後仍是建築學系、經驗 34、失敗旗標，再交談還是這一句。補剖面那一個旗標是假。固定畫面不能用來宣稱手勢流暢。

畫面檔：`/opt/cursor/artifacts/integration-route/08-faculty-choices.png`、`08b-faculty-line.png`。裝置是這台雲端主機的 headless Chrome，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這不是手機，也不是 RTX 3060。固定畫面不能用來宣稱動畫流暢。沒有重測三角形或幀時間。

## 大門以外的公共室內

這段打在合併 `88bc531`（main `57fc468`，球場標線 #149 與覺軒花園 #150）之後的工作樹。花園與標線的畫面是對方 STATUS 的紀錄，這裡沒有重看。

| 指令 | 結果 |
| --- | --- |
| `npx tsc --noEmit` | 通過 |
| `npm test` | 315 通過、0 失敗。含 `scripts/court-lines.test.mjs`、`scripts/garden-pavilion.test.mjs`，以及「continuing a living semester returns to the saved public interior」 |
| `npm run build:site` | 通過。`AdventureApp-B2sSdjRz.js`，入口 `index-ClUiOG2v.js`。`dist` 沒有 `revision_conflict` 或 `cloud-save` |
| `node --experimental-transform-types scripts/integration-interiors.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-interiors` | 通過，exit 0。`pageErrors` 空 |
| `npx eslint` 只掃這次改過的 `store.ts`、`home.ts`、`AdventureApp.tsx`、兩支腳本 | 既有 `store.ts:2132` `useFacility` rules-of-hooks 錯誤，以及既有 `dirty` 未使用警告。兩處都不在這次 diff。不把全庫 lint 說成通過 |

站點 `http://127.0.0.1:8088/`，預覽伺服的就是這次 `dist`。1280×720。瀏覽器 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這不是手機，也不是 RTX 3060。

標題預設選土木工程學系，存檔 id `engineering-工學院-1`。學期全程 `week-1`，狀態卡「第一週 · 先問入口方向」。

- 覺生紀念圖書館：門口「進入覺生紀念圖書館」，「上一樓」後室內列是「覺生紀念圖書館 · 2 樓」。`pagehide` 寫入 `interiorId: library`、`floor: 2`。標題按鈕出現時檔案仍是這兩欄。按「繼續學期」後仍是圖書館二樓，經驗 12。再按「返回校園」回到 `(10, -290)`。
- 鍾靈化學館：進入後室內列「鍾靈化學館 · 1 樓」，返回 `(288, -243.5)`，經驗 24。
- 紹謨紀念體育館：進入後室內列「紹謨紀念體育館 · 1 樓」，返回 `(166, -104.5)`，經驗 36。

24 與 36 是每棟既有地點發現 +12，不是新的室內獎勵。房間是遊戲重建，座標 estimated。室內普攻與技能寫「場景不可用」。返回鈕在室內列上，沒有被快捷列蓋住。

直接匯入一份室內存檔仍把人放在門口並清掉 `interiorId`。血量 0 的「繼續學期」也站在門口。這兩條是 `scripts/rpg-runtime.test.mjs` 的斷言，瀏覽器沒有再打倒地。

畫面：`/opt/cursor/artifacts/integration-interiors/library-floor-2.png`、`library-reloaded.png`、`chemistry-inside.png`、`gym-inside.png`。固定畫面不能用來宣稱動畫流暢。沒有重測三角形或幀時間。

## 顧衡的兩個衝突選項

這段打在 `e2d26ff` 的靜態建置 `AdventureApp-B2sSdjRz.js`，站點 `http://127.0.0.1:8088/`。之後 main 前進到 `4793fde`（小地圖課程標籤 #153、室內續玩 #155）。差異沒有改教職員對話，所以沒有把這兩句再打一次。合併後 `npx tsc --noEmit` 通過，`npm test` 315 通過、0 失敗。

| 指令 | 結果 |
| --- | --- |
| `node --experimental-transform-types scripts/integration-gu-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-gu-clash` | 通過，exit 0。`pageErrors` 空 |

1280×720。瀏覽器 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這不是手機，也不是 RTX 3060。

兩局都從標題選建築學系，存檔 id `engineering-工學院-0`。學期全程 `week-1`，狀態卡「第一週 · 先問入口方向」。

- 失敗版之後點「裂縫畫進圖，註明還沒修。」經驗 34→46，筆記 18→19，結果句「沒修完不叫好看，叫還沒做完。」提示「已入袋：課堂筆記 ×1」。`quest-faculty-gu-clash` 與 `quest-faculty-studio-clash` 各一筆。再交談沒有新的話，沒有第二筆。
- 走到化學館估計崗位。沈酌開場「顧衡說你把裂縫留在圖上。」經驗 46→58 是既有地點發現。兩個選項都在。按「離開，不結算」，沒有 `quest-faculty-shen-meet`。重載後經驗 58、筆記 19、誠實旗標還在。
- 另一局先補剖面，再點「圖先保持乾淨，裂縫另紙附上。」經驗同樣 34→46，筆記 19，結果句「另紙我收。」沈酌開場「顧衡說裂縫在另一張紙上。」離開不結算。重載後經驗 58、筆記 19、另紙旗標還在。

畫面：`/opt/cursor/artifacts/integration-gu-clash/honest-outcome.png`、`honest-shen.png`、`aside-outcome.png`、`aside-shen.png`。固定畫面不能用來宣稱手勢流暢。沒有重測三角形或幀時間。對方在 `http://127.0.0.1:8151/` 的室內續玩紀錄是他們的，不是這次衝突路線。

## 沈酌的兩個開場選項

這段打在 `e2d26ff` 的靜態建置 `AdventureApp-B2sSdjRz.js`，預覽 `http://127.0.0.1:8088/` 的入口是 `index-ClUiOG2v.js`。之後 main 前進到坡道欄杆 `83fa529`。差異在 `src/game/world/Props.tsx` 與坡道資料，沒有改教職員對話，所以沒有重打。合併後 `npx tsc --noEmit` 通過，`npm test` 316 通過、0 失敗。

| 指令 | 結果 |
| --- | --- |
| `node --experimental-transform-types scripts/integration-shen-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-shen-meet` | 通過，exit 0。`pageErrors` 空 |

1280×720。瀏覽器 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這不是手機，也不是 RTX 3060。

兩局都從標題選建築學系。先結算顧衡的衝突，再站到化學館南側的估計崗位。點下去之前存檔經驗 58、筆記 19。

- 「這是數據。我把步驟留在紀錄裡。」存檔經驗 76，筆記 19。結果句「那就留在你手邊。」狀態卡是 2 級、「經驗 16/180」、生命 108/108。學期仍是第一週。再交談是「你已經當它是數據。」下一拍兩個選項都在。離開不結算，沒有 `quest-faculty-shen-clash`。重載後經驗 76、筆記 19，再交談仍是這一句。
- 「我想重做到好看為止。」經驗同樣 58→76，筆記 19。結果句「可以重做。重做之前，舊的那一次還是要在。」下一句「這一頁不能為了重做先消失。」離開不結算。重載後這一句還在。

76 減 58 是 18：任務 `quest-faculty-shen-meet` 的 6，加上第一次走到她崗位的探索 12。那 12 點記在經驗事件，沒有多一筆 `discoveries`。

畫面：`/opt/cursor/artifacts/integration-shen-meet/data-outcome.png`、`data-next.png`、`redo-outcome.png`、`redo-reloaded.png`。固定畫面不能用來宣稱手勢流暢。坡道欄杆的畫面是對方 STATUS 的紀錄。

## 沈酌的兩個衝突選項

這段打在同一份 `AdventureApp-B2sSdjRz.js`，預覽 `http://127.0.0.1:8088/` 的入口仍是 `index-ClUiOG2v.js`。`main` 仍是 `83fa529`。這次只加腳本，沒有改遊戲程式，沒有重跑 `npm test`。上一輪合併欄杆之後是 316 通過、0 失敗。

| 指令 | 結果 |
| --- | --- |
| `node --experimental-transform-types scripts/integration-shen-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-shen-clash` | 通過，exit 0。`pageErrors` 空 |

1280×720。瀏覽器 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這不是手機，也不是 RTX 3060。

兩局都從標題選建築學系。先結算顧衡的衝突與沈酌對應的開場。點衝突之前存檔經驗 76、筆記 19。

- 「失敗那次寫進附錄，同組看得到。」存檔經驗 84，筆記 20。結果句「附錄就是給同組看的。我不會替你改成成功。」畫面是 2 級、「經驗 24/180」、生命 108/108、專注 100/100。學期仍是第一週。走到梁晚旁邊發現 `business-o`，經驗到 96，畫面「經驗 36/180」。她說「梁晚已經在條上寫了『附錄』兩個字。」兩個選項都在。離開不結算，沒有 `quest-faculty-liang-meet`。`quest-faculty-shen-clash` 只有一筆。重載後經驗 96、筆記 20，再交談仍是這一句。
- 「正文先寫成功的那次，失敗先放在你的紀錄。」經驗同樣 76→84，筆記 19→20。結果句「可以先放在我這裡。這不是作弊，也還沒有公開。」梁晚說「梁晚沒有把沈酌的名字寫上去。」同樣發現 `business-o`，經驗到 96。離開不結算。重載後這一句還在。

84 減 76 是 8，也就是衝突階段的經驗。筆記 +1 走既有 `give`。96 減 84 是既有地點發現 12，不是梁晚的對話獎勵。

畫面：`/opt/cursor/artifacts/integration-shen-clash/public-outcome.png`、`public-liang.png`、`office-outcome.png`、`office-reloaded.png`。固定畫面不能用來宣稱手勢流暢。

## 梁晚的兩個開場選項

這段打在重建前的 `AdventureApp-B2sSdjRz.js`，預覽當時的入口是 `index-ClUiOG2v.js`。之後 `main` 進到 `e95c137`（雲端校園快照 #162）。差異在 `src/features/cloud-save/**` 與雲端測試，沒有改教職員對話，所以沒有重打。

| 指令 | 結果 |
| --- | --- |
| `node --experimental-transform-types scripts/integration-liang-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-liang-meet` | 通過，exit 0。`pageErrors` 空 |
| `npx tsc --noEmit` | 通過。對象是合併後的原始碼 |
| `npm test` | 322 通過、0 失敗。對象是合併後的原始碼 |
| `npm run build:site` | 通過。產出 `index-B0jBbET6.js` 與 `AdventureApp-BoDdWjJ4.js`。字面沒有 `revision_conflict`、`cloud-save`、`DATABASE_URL`。對話沒有打在這包上 |

1280×720。瀏覽器 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。沒有讀回 WebGL renderer 字串。這台主機是 SwiftShader，細指標桌面視窗。

兩局都從標題選建築學系。先結算顧衡、沈酌，再站到梁晚的估計崗位。點下去之前存檔經驗 96、筆記 20。

- 「我寫成我們三個人都同意的句子。」存檔經驗 114，筆記 20。結果句「先不要。沈酌沒有說她同意，顧衡也沒有。」畫面是 2 級、「經驗 54/180」、生命 108/108、專注 100/100。學期仍是第一週。再交談是「這句還不能用。」下一拍兩個選項都在。離開不結算，沒有 `quest-faculty-liang-clash`。重載後經驗 114、筆記 20，再交談仍是這一句。
- 「我只寫我自己的請求，不代他們發言。」經驗同樣 96→114，筆記 20。結果句「這句我收。名字是你的。」下一句「你的請求我留下了。」離開不結算。重載後這一句還在。

114 減 96 是 18：任務 `quest-faculty-liang-meet` 的 6，加上第一次結算崗位 `post-liang-wan` 的探索 12。那 12 點記在經驗事件，沒有多一筆 `discoveries`。筆記停在 20，因為開場階段不加筆記。

畫面：`/opt/cursor/artifacts/integration-liang-meet/ours-outcome.png`、`ours-next.png`、`mine-outcome.png`、`mine-reloaded.png`。固定畫面不能用來宣稱手勢流暢。對方在 `http://127.0.0.1:8153/` 的雲端快照紀錄是他們的。

## 梁晚的兩個出處選項

這段打在 `AdventureApp-BoDdWjJ4.js`，預覽當時的入口是 `index-B0jBbET6.js`。之後 `main` 進到 `b579dff`（收集委託 #164）。差異在委託資料、`gathered`／`felled` 與雲端白名單，沒有改教職員對話，所以沒有重打。

| 指令 | 結果 |
| --- | --- |
| `node --experimental-transform-types scripts/integration-liang-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-liang-clash` | 通過，exit 0。`pageErrors` 空 |
| `npx tsc --noEmit` | 通過。對象是合併後的原始碼 |
| `npm test` | 325 通過、0 失敗。對象是合併後的原始碼 |
| `npm run build:site` | 通過。產出 `index-D1yzos4G.js` 與 `AdventureApp-BztmqH0m.js`。字面沒有 `revision_conflict`、`cloud-save`、`DATABASE_URL` |
| `node --experimental-transform-types scripts/integration-journal.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-journal` | 通過，exit 0。打在重建後的包。`pageErrors` 空 |

1280×720。瀏覽器 `/usr/bin/google-chrome`，啟動參數含 `--enable-unsafe-swiftshader`。這台主機是 SwiftShader，細指標桌面視窗。

兩局都從標題選建築學系。先結算到梁晚的開場。點出處之前存檔經驗 114、筆記 20。

- 「兩份出處並列，註明各自是哪一次的說法。」存檔經驗 122，筆記 21。結果句「並列可以貼。」畫面是 2 級、「經驗 62/180」、生命 108/108、專注 100/100。學期仍是第一週。顧衡說「句子是你的，我收到了。」兩個時段選項都在。離開不結算，沒有 `quest-faculty-gu-turn`。重載後經驗 122、筆記 21，再交談仍是這一句。
- 「先貼訪談，出處下週補上。」經驗同樣 114→122，筆記 20→21。結果句「下週要補。」顧衡說「海報可以晚。」離開不結算。重載後這一句還在。

122 減 114 是 8，也就是衝突階段的經驗。筆記 +1 走既有入袋。

畫面：`/opt/cursor/artifacts/integration-liang-clash/both-outcome.png`、`both-gu.png`、`later-outcome.png`、`later-reloaded.png`。

重建後的新學期打開「學期委託」。四條新委託進度是 0。`gathered` 四項是 0，`felled.report` 是 0，沒有領取。學期仍是第一週，狀態卡 1 級、經驗 0/60。沒有把 12 份收集做完，也沒有走十個巡邏點。對方 `docs/quest-play/evidence/` 的完成畫面是他們的。

畫面：`/opt/cursor/artifacts/integration-journal/journal-collections.png`。
