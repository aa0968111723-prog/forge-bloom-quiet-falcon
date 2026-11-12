# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `d32e714`。路燈 #141、教職員 #139、遭遇 #136、裝備 #133、圖書館坡道 #143、裝備欄雲端契約 #144 都在 main，也在這個分支。不要再合一次。
- 九學院技能打在坡道合併 `90f906baf8a2a09963f88409ced4327eae1a43de` 的靜態建置上。隨後的 `fbefee8` 只併入對方的雲端裝備測試與整合筆記。
- 第一堂異象課領取後進入期末，那是更早的路線，提交 `a56956c`。見 VALIDATION.md。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`。2026-11-12T02:59:00Z 查看時是 RUNNING。合併仍交給那條線。
- `docs/integration/**` 是對方的。這條線只寫 `docs/full-integration/**`。
- `MAIN_INTEGRATION` 保持 false。存檔鍵 `tamkang-rpg-v2`，版本 2。

## 怎麼重跑

```
npx tsc --noEmit
npm test
npm run build:site
node --experimental-transform-types scripts/integration-route.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-route
node --experimental-transform-types scripts/integration-colleges.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-colleges
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。顧衡這段是在 1280×720 點的。

## 下一步

1. 重新抓 `origin/main`。對方又推了新提交才接。坡道 #143 與裝備欄契約 #144 已經在這個分支，不要再合一次。
2. 九個學院的技能已各從標題選科系打過 quiz-2。七區路網與攝影機還沒在這個建置上重走。
3. 手勢流暢度要另錄，不要用單張畫面宣稱。
4. 顧衡的失敗選項這次只出現在先前畫面上，瀏覽器沒有點。結果句在 `scripts/faculty-story.test.mjs`。
5. 條件仍不符時，只更新這條線的 PR，不合 `main`。
