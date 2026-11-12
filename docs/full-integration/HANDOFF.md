# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `327520d`。換帳號停佇列是整合 PR #196，坡道欄杆碰撞是整合 PR #194，也在這個分支（合併提交 `91b1c83`）。靜態檔名是 `AdventureApp-D3TATbW2.js`，入口 `index-Dl3m_ZgE.js`。
- 顧衡的兩個收尾各在一局新學期點過。存檔經驗 206→216，筆記 23→24，畫面是 2 級、經驗 156/180。沈酌的下一句跟著先前紀錄，兩個短記選項沒有點。見 VALIDATION.md。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`。2026-11-12T05:37Z 查看時是 RUNNING，分支是 `cursor/integration-art-m1-3395`。後端當時也在 RUNNING。玩法尖端上次是 `3270f9f`，`store.ts` 落後，不要整支合併。合併仍交給原整合線。許回已接線，這條線沒有點她。
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
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。室內這段是在 1280×720 點的。

## 下一步

1. 重新抓 `origin/main`。換帳號停佇列 #196 與坡道欄杆 #194 已經在這個分支，不要再合一次。對方又推了新提交才接。
2. 顧衡的收尾兩句已各點過一次，重載保留。沈酌的短記跟著先前紀錄。「請你寫一張短記，讓我夾進圖。」和「不用字條。我自己在評圖上說。」瀏覽器沒有點。梁晚的海報要等短記結算才開。
3. 許回已接在圖書館估計門口外。對方的畫面是他們的紀錄。這條線還沒點。另外三條收集仍是 0。後端線當時仍在寫，不要把那條分支再合一次。坡道這次沒有走。
4. 玩法尖端 `3270f9f` 的目錄與戰鬥檔和這條線有差。他們的 `store.ts` 落後。要接時只接新遭遇，不要整支合併。
5. 手勢流暢度要另錄，不要用單張畫面宣稱。
6. 條件仍不符時，只更新這條線的 PR，不合 `main`。
