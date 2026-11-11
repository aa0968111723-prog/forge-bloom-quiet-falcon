# 整合狀態

更新：2026-11-11。`main` 的程式提交是 `5d075b2`。校園門口的敘事已在整合分支驗過，尚未進 `main`。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 學院施法姿勢已在 `main`。化學學系技能播 `skill-science`，傷害仍是既有 `attackFx`。 | [#12](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/12) 與 [#14](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/14) 已合併 | `merged` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽已在 `main`。校園裡走到大門再按進入，會先打開同一段對話，獎勵寫進既有經驗、背包與 `claimed`。 | 預覽已合併。校園接線在整合分支，準備合併 | `ready_to_merge` |

不操作其他代理正在改的工作區。

## 本輪範圍

玩家在校園按下建築的進入時，若該地點有敘事事件，先走 `selectEvent`。獎勵差額寫回既有的經驗、筆記、學分與 `claimed`。事件記憶放在同一份 `tamkang-rpg-v2` 的 `narrative` 欄位。`/narrative` 預覽仍在。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 校園進入點接到敘事。大門對話、一次獎勵、再按進入會進建築 |
| 已驗證 | typecheck、244 項測試。校園頁：經驗 20、筆記 19（開局 18 加 1）、`claimed` 含 `quest-orient-gate`、旗標寫入同一份存檔。第二次進入不再交談。`pageErrors` 空 |
| 已合併 | 尚未。敘事預覽本身已在 `5d075b2` |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。雲端同步的第二客戶端是流程腳本驗的，不是手機操作。
