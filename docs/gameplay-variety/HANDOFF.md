# 交接

分支 `cursor/gameplay-variety-fb95`，從 `origin/main` `65507cd` 拉出。只推這條分支，不合併。

擁有 `src/features/gameplay-variety/**`、`docs/gameplay-variety/**`、`scripts/gameplay-variety.test.mjs`。主遊戲只加了面板 token `variety`、HUD 掛載與場景上的地面環。沒有改敵人表、敘事旗標或別人的未提交檔案。

本線存檔鍵是 `tamkang-gameplay-variety-v1`。獎勵由 `host.ts` 的 `grantQuestReward` 寫回既有經驗、筆記與學分。溢位進既有掉落堆。`readStorySignals()` 給統整線，型別是 `variety.resolved`。

重跑：`node --test scripts/gameplay-variety.test.mjs`，然後 `npx tsc --noEmit`。主遊戲用 `npm run dev`，`?qa=1` 才有 `window.__rpgQA`。

未完成：扇形小考、護盾監考、截止日桌子還沒在主遊戲打完。手機與 RTX 3060 沒有實測。沒有 CI 結果。校園點位仍是估計。

下一步：統整線決定要不要讀 story signal。這條線不要改共用 store 的其他欄位。
