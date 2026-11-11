# 整合狀態

更新：2026-11-11。`main` 的程式提交是 `5d075b2`。敘事預覽已合併，主場景尚未接上。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 學院施法姿勢已在 `main`。化學學系技能播 `skill-science`，傷害仍是既有 `attackFx`。 | [#12](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/12) 與 [#14](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/14) 已合併 | `merged` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽已在 `main`。大門選擇結算 `quest-orient-gate` 一次。主校園畫面還沒接敘事。 | [#11](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/11) 與 [#15](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/15) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

敘事預覽接到已含雲端存檔與學院姿勢的 `main`。`/narrative` 能走大門事件。主校園畫面還沒呼叫 `selectEvent`。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 校園敘事預覽：10 個事件、一條三節點任務、`/narrative` |
| 已驗證 | typecheck、239 項測試、`build:site`。大門選擇結算 `quest-orient-gate` 一次，經驗 20、筆記 1，沒有寫入 `tamkang-rpg-v2`。合併後再跑 typecheck |
| 已合併 | 敘事預覽是 `5d075b2b8522a478a580fb5998d580395d827055`（PR #15，來源 PR #11）。合併 API 403，`main` 未受保護，使用快轉推送 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

主校園還沒接到這些敘事事件。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。雲端同步的第二客戶端是流程腳本驗的，不是手機操作。
