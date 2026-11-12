# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `b579dff`。收集委託 #164 在 main，也在這個分支（合併提交 `7e2ada5`）。對話檔沒有改。對方的完成畫面是他們的紀錄。
- 梁晚的兩個出處選項各在一局新學期點過。存檔經驗 114→122，筆記 20→21，狀態卡仍是 2 級、經驗 62/180。顧衡的時段兩句沒有點。打在 `AdventureApp-BoDdWjJ4.js`。見 VALIDATION.md。
- 重建後的 `AdventureApp-BztmqH0m.js` 上，學期委託看得到四條新收集，進度都是 0。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`。2026-11-12T04:13Z 查看時是 RUNNING。後端尖端 `4cdd8d7` 比 #164 再往前，對方還在寫。玩法尖端 `3270f9f` 的 `store.ts` 落後這條線，不要整支合併。合併仍交給原整合線。
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
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。室內這段是在 1280×720 點的。

## 下一步

1. 重新抓 `origin/main`。收集委託 #164 已經在這個分支，不要再合一次。對方又推了新提交才接。
2. 梁晚的出處兩句已各點過一次，重載保留。顧衡的時段「我去找主任，評圖改到走廊，教室先給社團。」和「我請社團先用一小時，評圖往後挪。」出現了，瀏覽器沒有點。
3. 四條收集委託在新包的學期委託裡是 0。還沒在這條線把 12 份收集做完，也還沒走十個巡邏點。
4. 後端尖端已到 `4cdd8d7`，比 #164 再往前。內容版本仍是 2。對方還在寫，先重讀當時的 `contract.ts`，不要把那條分支再合一次。
5. 玩法尖端 `3270f9f` 的目錄與戰鬥檔和這條線有差。他們的 `store.ts` 落後。要接時只接新遭遇，不要整支合併。
6. 手勢流暢度要另錄，不要用單張畫面宣稱。
7. 條件仍不符時，只更新這條線的 PR，不合 `main`。
