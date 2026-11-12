# 統整線交接

分支：`cursor/integration-full-game-f7e4`。
不要把這個分支推上 `main`。上游若仍指向 `origin/main`，只使用 `git push -u origin cursor/integration-full-game-f7e4`。

## 現在停在哪

- 基線 `468a516efb1649d08f0427f586c11f8d2341e12b`。學期查詢已在 main，整合 PR #125。不要再合一次。
- 瀏覽器放置、取消、一盞燈與徽章路線在 `8ef6496c3e61ff60c1d956b1d012bd4750704971`。
- 唯一合併者：`bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`，查看當下是 RUNNING。合併仍交給那條線。不要把對方沒有新提交當成已經停止，也不要中止對方。
- `docs/integration/**` 是對方的。這條線只寫 `docs/full-integration/**`。
- `MAIN_INTEGRATION` 保持 false。存檔鍵 `tamkang-rpg-v2`，版本 2。沒有新的遷移函式，因為學期是從既有 `claimed` 算出來的。

## 怎麼重跑

```
npx tsc --noEmit
npm test
npm run build:site
node --experimental-transform-types scripts/integration-route.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-route
```

預覽是 `npm run preview:site`，埠 8088。路線瀏覽器強制 SwiftShader。390×780 在這台機器上是細指標窄窗。

## 下一步

1. 重新抓 `origin/main`。美術佇列若已前進，不要把已整合的來源 PR 再合一次。
2. 期末只在期中且任務 `first` 已領取之後出現。不要用除錯選單跳過未完成任務。
3. report、exam 與九個學院技能還沒在這條路線各走一次。
4. 其他三線一旦有自己的分支，再把它們的共享入口接到這份 store。不要開第二個背包。
5. 條件仍不符時，只更新這條線的 PR，不合 `main`。
