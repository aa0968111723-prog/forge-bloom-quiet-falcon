# 整合狀態

更新：2026-11-11。`main` 是 `f898230`。遊戲與雲端存檔在 `b260c87`，其後這份記錄只改文件。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | M2 已在 `main`。新的開放 PR [#12](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/12) 是學院施法姿勢，head `c1a3bb3`，和已合併的 NPC 檔案重疊，尚未整合。 | #10 已合併。#12 開放 | `discovered`（#12） |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | 草稿 PR [#11](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/11)，`feature/game-content-world` @ `54a997e`。校園敘事預覽，尚未接到目前 `main`。 | #11 草稿 | `discovered` |

不操作其他代理正在改的工作區。

## 本輪範圍

美術 M2 已在 `main`。其後把可選雲端存檔接到同一棵樹，並讓 NPC 組裝在開發模式的 strict mode 下可以跑第二次。戰鬥仍讀 `useRpg`。靜態版不包含雲端 API。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 美術 M2，以及可選 RPG 雲端存檔 |
| 已驗證 | M2：typecheck、225 項測試、省電路線與三種怪物畫面。雲端存檔：typecheck、227 項測試、靜態建置不含雲端字樣、Node 頁面看得到選配面板。SwiftShader，不是真機 |
| 已合併 | 美術 M2 是 `df63d01`（PR #10）。雲端存檔是 `b260c87fbdcb2e4b2e328c94f989c479124e75ba`（PR #13，來源 PR #9）。合併 API 403，`main` 未受保護，使用快轉推送 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

雲端同步已在 `main`，第二客戶端與衝突是流程腳本驗的，不是手機操作。內容敘事仍是草稿 PR #11。學院施法姿勢是開放 PR #12。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。
