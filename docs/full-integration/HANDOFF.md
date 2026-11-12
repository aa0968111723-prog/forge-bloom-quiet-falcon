# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `57fc468`。路燈 #141、教職員 #139、遭遇 #136、裝備 #133、坡道 #143、裝備欄契約 #144、球場淨空 #146、雨天球場 #147、球場標線 #149、覺軒花園 #150 都在 main，也在這個分支（合併提交 `88bc531`）。不要再合一次。花園畫面是對方的紀錄。
- 活著的「繼續學期」會回到存檔裡的公共室內。圖書館二樓打在 `AdventureApp-B2sSdjRz.js`。化學館與體育館進出去過。見 VALIDATION.md。
- 顧衡的失敗選項打在 `2f7667b` 的建置 `AdventureApp-LRjQocEU.js`。雨天球場沒有改這段對話。七區路點與九學院技能見 VALIDATION.md。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`。2026-11-12T03:31:24Z 查看時是 RUNNING。合併仍交給那條線。
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
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。室內這段是在 1280×720 點的。

## 下一步

1. 重新抓 `origin/main`。對方又推了新提交才接。標線 #149 與花園 #150 已經在這個分支，不要再合一次。
2. 圖書館二樓的繼續學期已在主遊戲點過。倒地續玩只在單元測試，瀏覽器沒有再打。
3. 顧衡衝突那一拍的兩個選項出現過，瀏覽器沒有點。這是下一個可玩缺口。
4. 手勢流暢度要另錄，不要用單張畫面宣稱。
5. 390×780 的快捷列會蓋住角色下半身。那是細指標窄窗，不是手機 HUD。
6. 條件仍不符時，只更新這條線的 PR，不合 `main`。
