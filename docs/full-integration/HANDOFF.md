# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `4793fde`。小地圖課程標籤 #153 與室內續玩 #155 都在 main，也在這個分支（合併提交 `823ce2b`）。室內續玩的來源是這條線的 `e2d26ff`，由對方合入。不要再合一次。小地圖畫面是對方的紀錄。
- 顧衡的兩個衝突選項各在一局新學期點過。沈酌的開場跟著旗標變了，她的兩個選項沒有點。打在 `AdventureApp-B2sSdjRz.js`。見 VALIDATION.md。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`。2026-11-12T03:42:00Z 查看時是 RUNNING。教職員、玩法、道具三條線當時也在 RUNNING。合併仍交給原整合線。
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
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。室內這段是在 1280×720 點的。

## 下一步

1. 重新抓 `origin/main`。對方又推了新提交才接。小地圖 #153 與室內續玩 #155 已經在這個分支，不要再合一次。
2. 顧衡的兩個衝突選項已各點過一次，重載保留。沈酌的兩個選項出現了，瀏覽器沒有點。這是下一個可玩缺口。
3. 手勢流暢度要另錄，不要用單張畫面宣稱。
4. 390×780 的快捷列會蓋住角色下半身。那是細指標窄窗，不是手機 HUD。
5. 條件仍不符時，只更新這條線的 PR，不合 `main`。
