# 內容工作基線

查閱日期：2026-11-11。起點是 `origin/main` `71f4d3c`（Implement jade campus fantasy art direction）。工作區在接手時是乾淨的。

## 遠端與分支

- remote：`https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon`
- 本分支：`feature/game-content-world`
- 其他遠端分支：`backup/pre-sites-rpg-sync-20261111`、`claude/tamkang-reality-campus-v1-2bxs0g`
- 開放 PR：[#6](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/6) `cursor/tamkang-art-pipeline-1a71`，美術管線與可玩樣本。本分支不改角色 GLB、動畫或場景入口。

## 沿用的結構

- 校園 permanentId、alias、七區：`src/game/world-data/registry/index.ts`
- 學院與科系 id：`src/game/departments.ts`。`src/game/rpg/data.ts` 另有一套產生出來的科系 id，敘事不採用。
- 獎勵：`grantQuestReward` 與 `replayFastTravel`。不另開背包、HP 或雲端存檔。
- 轉向：Yuka `Vehicle` / `SeekBehavior`，已在 `src/game/rpg/store.ts`。
- 背包：`@overworld-engine/inventory` 的 `createInventory`，已在 `store.ts`。
- 對話焦點：`src/game/rpg/dialog.ts` 只處理焦點與 inert，不是任務圖。
- 環境音：`src/game/audio.ts` 程式合成，沒有第三方取樣。

## 本輪沒有做的事

- 不重做登入、資料庫、雲端存檔。
- 不把預覽頁標成主遊戲已整合。`MAIN_INTEGRATION` 是 false，`AdventureApp` 沒有引用敘事模組。
- 不宣稱 24 條任務鏈或 120 個事件已完成。
