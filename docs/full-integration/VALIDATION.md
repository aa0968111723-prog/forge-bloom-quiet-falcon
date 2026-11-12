# 統整線驗證

遊戲程式：`90768e40afcba821de2650955ee903b06b34cb73`。
放置與裝備的 store 斷言：`9c45f10509867c9bde1aa9a95e2e85f167a87e20`（只加測試，客戶端 bundle 與路線當時的建置相同）。
基線：`origin/main` `4b88b772d4e21424dd14b502655c1239b1abd8bf`。

這些指令是在該工作樹上親自跑的。沒有 CI。沒有 required checks 不算驗收通過。

| 指令 | 結果 |
| --- | --- |
| `npx tsc --noEmit` | 通過。在 `90768e4` 的工作樹，放置測試尚未加入，型別沒有再改 |
| `npm test` | 269 通過、0 失敗。放置斷言加進既有測試後再跑一次，仍是 269 通過、0 失敗 |
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

## live store，尚未在瀏覽器點選

同一份 `useRpg`：先把燈放在角色身上，`place` 回 false，不入帳。`cancelBuild` 清掉建造模式。再在 `validatePlacement` 允許的格子放一盞燈，經驗 +12、筆記淨變化是成本 3 再加委託 2、零件 -3，委託 id 只有一筆。同一格再放一次不會再付。徽章 `equip` 可裝上再卸下，不構成第二次委託。
