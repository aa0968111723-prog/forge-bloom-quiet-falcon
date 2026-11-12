# 統整線驗證

瀏覽器路線所在提交：`8ef6496c3e61ff60c1d956b1d012bd4750704971`。
基線 `origin/main`：`468a516efb1649d08f0427f586c11f8d2341e12b`。學期查詢已在這條 main 上，整合 PR #125，遊戲程式 `9c803bb`。

這些指令是在該工作樹上親自跑的。沒有 CI。沒有 required checks 不算驗收通過。

| 指令 | 結果 |
| --- | --- |
| `npx tsc --noEmit` | 通過。在 `90768e4` 的工作樹，放置測試尚未加入，型別沒有再改 |
| `npm test` | 合併後 271 通過、0 失敗 |
| `npm run build:site` | 通過。`dist/assets` 沒有 `revision_conflict` 或 `cloud-save` |
| `node --experimental-transform-types scripts/integration-route.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-route` | 通過。`pageErrors` 空、離線遊玩時頁面 API 請求空、`ok: true` |
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

固定畫面不能用來宣稱動畫流暢。沒有重測三角形或幀時間。
