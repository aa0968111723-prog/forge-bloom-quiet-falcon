# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `afb6cbd0a731a68a10ebd4edb2a26571c1ed3205`。裝備已在 main，整合 PR #133。不要再合一次。
- 遊戲提交 `85619e4288e341badee32d5cfe6ce999e28b631c` 把那份背包和顧衡、宮燈夜巡放在同一條分支。雲端白名單在下一個提交。
- 同一條主遊戲路線在這個建置上點了顧衡的補剖面選項。見 VALIDATION.md。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`，查看當下是 RUNNING。合併仍交給那條線。
- `docs/integration/**` 是對方的。這條線只寫 `docs/full-integration/**`。
- `MAIN_INTEGRATION` 保持 false。存檔鍵 `tamkang-rpg-v2`，版本 2。

## 怎麼重跑

```
npx tsc --noEmit
npm test
npm run build:site
node --experimental-transform-types scripts/integration-route.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-route
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。顧衡這段是在 1280×720 點的。

## 下一步

1. 重新抓 `origin/main`、`origin/cursor/faculty-story-75f5`、`origin/cursor/items-equipment-building-15c5`。對方又推了新提交才接，不要把同一功能再合一次。
2. 教職員 `246eadf` 比已接上的 `7f6f3c8` 新。先抓遠端再接手勢和後續選項，不要重做開場。
3. 期末只在期中且任務 `first` 已領取之後出現。另外八個學院的技能還沒換科系打過。
4. 顧衡的另一個選項這次只出現在畫面上，瀏覽器沒有點。失敗版的結果句在 `scripts/faculty-story.test.mjs`。
5. 條件仍不符時，只更新這條線的 PR，不合 `main`。
