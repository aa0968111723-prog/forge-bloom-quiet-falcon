# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `7c85a4245368b2bfe3ea5d6589f969030bdc82d9`。路燈 #141、教職員 #139、遭遇 #136、裝備 #133、圖書館坡道 #143、裝備欄雲端契約 #144、球場淨空 #146 都在 main，也在這個分支。不要再合一次。
- 七區路點走在 `15fcc9c` 之後的建置 `AdventureApp-LRjQocEU.js`。九學院技能仍是更早的 `90f906b` 建置。期末路線仍是 `a56956c`。見 VALIDATION.md。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`。2026-11-12T03:08:00Z 查看時是 RUNNING。合併仍交給那條線。
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
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。顧衡這段是在 1280×720 點的。

## 下一步

1. 重新抓 `origin/main`。對方又推了新提交才接。球場淨空 #146、坡道 #143、裝備欄契約 #144 已經在這個分支，不要再合一次。
2. 七區各有一個估計路點已經走完，跟隨鏡頭留在身後約 5.1 公尺。沒有把每條折線走完。顧衡的失敗選項還沒在瀏覽器裡點。
3. 手勢流暢度要另錄，不要用單張畫面宣稱。
4. 390×780 的快捷列會蓋住角色下半身。那是細指標窄窗，不是手機 HUD。
5. 條件仍不符時，只更新這條線的 PR，不合 `main`。
