# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `83fa529`。圖書館坡道欄杆 #159 在 main，也在這個分支（合併提交 `be9ceb6`）。對話檔沒有改。欄杆畫面是對方的紀錄。
- 沈酌的兩個開場選項各在一局新學期點過。存檔經驗 58→76，筆記停在 19，狀態卡升到 2 級、經驗 16/180。下一拍沒有點。打在 `AdventureApp-B2sSdjRz.js`。見 VALIDATION.md。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`。2026-11-12T03:54:32Z 查看時是 RUNNING。後端線在 `cursor/backend-db-link-6038`，尖端 `7f400ba` 還沒進 main。合併仍交給原整合線。
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
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。室內這段是在 1280×720 點的。

## 下一步

1. 重新抓 `origin/main`。對方又推了新提交才接。坡道欄杆 #159 已經在這個分支，不要再合一次。
2. 沈酌的開場兩句已各點過一次，重載保留。下一拍「失敗那次寫進附錄」和「正文先寫成功的那次」出現了，瀏覽器沒有點。
3. 後端尖端 `7f400ba` 的雲端白名單還沒接。先重讀當時的 `contract.ts`，內容版本仍是 2。對方還在寫，不要把那條分支直接合進來。
4. 手勢流暢度要另錄，不要用單張畫面宣稱。
5. 條件仍不符時，只更新這條線的 PR，不合 `main`。
