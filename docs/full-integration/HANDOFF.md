# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `6e90df9`。它註記 PR #234。GitHub 上這份 PR 的狀態是 MERGED。同一段還有 PR #233，GitHub 狀態也是 MERGED。遊戲提交 `79cdcae` 與 `6ac1cb2` 已在 main，也在這個分支（合併提交 `90cfb4b`）。過長的地面掉落編號仍帶著物品，座標不能用的掉落堆被拉回界內。靜態檔名是 `AdventureApp-DjCbJVkI.js`，入口 `index-Cf89NQE2.js`，888429 bytes。
- 安澄的兩個欄位各在一局新學期點過。衝突已結算，存檔經驗 38→46，筆記停在 19，畫面是 1 級、經驗 46/60。貼牆兩句都在，沒有點。見 VALIDATION.md。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`。2026-11-12T07:45Z 查看時是 RUNNING，分支是 `cursor/integration-art-m1-3395`。後端當時也在 RUNNING。玩法尖端上次是 `3270f9f`，`store.ts` 落後，不要整支合併。合併仍交給原整合線。許回已接線，這條線沒有點她。田徑場內野和坡道側欄仍沒有走。
- `docs/integration/**` 是對方的。這條線只寫 `docs/full-integration/**`。
- `MAIN_INTEGRATION` 保持 false。存檔鍵 `tamkang-rpg-v2`，版本 2。

## 怎麼重跑

```
npx tsc --noEmit
npm test
npm run build:site
node --experimental-transform-types scripts/integration-route.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-route
node --experimental-transform-types scripts/integration-colleges.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-colleges
node --experimental-transform-types scripts/integration-roads.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-roads
node --experimental-transform-types scripts/integration-gu-fail.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-gu-fail
node --experimental-transform-types scripts/integration-interiors.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-interiors
node --experimental-transform-types scripts/integration-gu-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-gu-clash
node --experimental-transform-types scripts/integration-shen-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-shen-meet
node --experimental-transform-types scripts/integration-shen-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-shen-clash
node --experimental-transform-types scripts/integration-liang-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-liang-meet
node --experimental-transform-types scripts/integration-liang-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-liang-clash
node --experimental-transform-types scripts/integration-journal.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-journal
node --experimental-transform-types scripts/integration-reports.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-reports
node --experimental-transform-types scripts/integration-gu-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-gu-turn
node --experimental-transform-types scripts/integration-qiu-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-qiu-meet
node --experimental-transform-types scripts/integration-qiu-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-qiu-clash
node --experimental-transform-types scripts/integration-qiu-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-qiu-turn
node --experimental-transform-types scripts/integration-liang-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-liang-turn
node --experimental-transform-types scripts/integration-shen-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-shen-turn
node --experimental-transform-types scripts/integration-qiu-after.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-qiu-after
node --experimental-transform-types scripts/integration-gu-after.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-gu-after
node --experimental-transform-types scripts/integration-shen-after.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-shen-after
node --experimental-transform-types scripts/integration-liang-after.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-liang-after
node --experimental-transform-types scripts/integration-he-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-he-meet
node --experimental-transform-types scripts/integration-he-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-he-clash
node --experimental-transform-types scripts/integration-he-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-he-turn
node --experimental-transform-types scripts/integration-he-after.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-he-after
node --experimental-transform-types scripts/integration-xi-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-xi-meet
node --experimental-transform-types scripts/integration-xi-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-xi-clash
node --experimental-transform-types scripts/integration-xi-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-xi-turn
node --experimental-transform-types scripts/integration-xi-after.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-xi-after
node --experimental-transform-types scripts/integration-wei-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-wei-meet
node --experimental-transform-types scripts/integration-wei-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-wei-clash
node --experimental-transform-types scripts/integration-wei-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-wei-turn
node --experimental-transform-types scripts/integration-wei-after.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-wei-after
node --experimental-transform-types scripts/integration-an-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-an-meet
node --experimental-transform-types scripts/integration-an-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-an-clash
node --experimental-transform-types scripts/integration-an-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-an-turn
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。室內這段是在 1280×720 點的。

## 下一步

1. 重新抓 `origin/main`。過長掉落編號 #233 和拉回界內的掉落堆 #234 已經在這個分支，不要再合一次。對方又推了新提交才接。田徑場內野和坡道側欄仍沒有走。
2. 安澄的欄位兩句已各點過一次，重載保留。貼牆那一句不看欄位選了哪句。「就照這個版本貼上發表牆。」和「我改一個詞再貼，你只看那個詞。」瀏覽器沒有點。
3. 許回已接在圖書館估計門口外。對方的畫面是他們的紀錄。這條線還沒點。另外三條收集仍是 0。後端線當時仍在寫，不要把那條分支再合一次。
4. 玩法尖端 `3270f9f` 的目錄與戰鬥檔和這條線有差。他們的 `store.ts` 落後。要接時只接新遭遇，不要整支合併。
5. 手勢流暢度要另錄，不要用單張畫面宣稱。
6. 條件仍不符時，只更新這條線的 PR，不合 `main`。
