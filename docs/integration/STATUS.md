# 整合狀態

更新：2026-11-11。學院地面施法抬高與括號修正在整合分支，尚未進 `main`。校園敘事已在 `c279651`。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 學院地面施法抬到鋪面之上，資訊括號不再是空的位置陣列。傷害仍讀 `attackFx`。 | [#16](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/16) 準備合併 | `ready_to_merge` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽與校園進入點都在 `main`。大門對話的獎勵寫進既有經驗、背包與 `claimed`。 | [#18](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/18) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

學院地面施法整組抬高 0.16 公尺，避免被宮燈大道鋪面蓋住。資訊學院的命中括號改走非索引幾何，三角形不再被丟掉。傷害仍讀 `attackFx`。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 地面施法抬高，資訊括號閉合 |
| 已驗證 | typecheck、244 項測試，其中美術管線 17 項含離地與括號頂點。化學學系技能有施放，地面可見淡紫色環。`pageErrors` 空 |
| 已合併 | 尚未 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。雲端同步的第二客戶端是流程腳本驗的，不是手機操作。
