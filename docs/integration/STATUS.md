# 整合狀態

更新：2026-11-11。`main` 的程式提交是 `9256c85`。學院施法姿勢已合併。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 學院施法姿勢已在 `main`。化學學系技能播 `skill-science`，傷害仍是既有 `attackFx`。 | [#12](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/12) 與 [#14](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/14) 已合併 | `merged` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽已接到整合分支。大門選擇結算 `quest-orient-gate` 一次。主校園畫面還沒接敘事。 | [#11](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/11) 草稿，整合分支準備合併 | `ready_to_merge` |

不操作其他代理正在改的工作區。

## 本輪範圍

學院施法姿勢接到已含雲端存檔的 `main`。非工程科系播 `skill-<discipline>`。傷害仍讀 `attackFx`。卸載仍只用 `releaseArtInstance`。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 八學院各自的施法姿勢，接在既有技能上 |
| 已驗證 | typecheck、228 項測試、`build:site`。化學學系播 `skill-science`，`quiz-2` 65→13。合併後再跑 typecheck。SwiftShader，不是真機 |
| 已合併 | 學院施法姿勢是 `9256c858be3972272804c2689bb221bdf679bf28`（PR #14，來源 PR #12）。合併 API 403，`main` 未受保護，使用快轉推送 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

內容敘事仍是草稿 PR #11。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。雲端同步的第二客戶端是流程腳本驗的，不是手機操作。
