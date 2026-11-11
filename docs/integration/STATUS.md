# 整合狀態

更新：2026-11-11。整合分支 `cursor/integration-art-m1-3395`。
本文件只記實際程式、PR 與本輪驗收。不把 M1 樣板當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 資產管線、主角 `char.student-kit`／LOD1、考卷怪 `creature.quiz`、工程技能「結構脈衝」。NPC、其餘怪物與八學院技能、七區仍是既有程式。 | [#6](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/6) `017b755` | 併入本整合分支，見佇列 `art-m1` |
| 後端 | 尚無新分支、新提交或 PR。雲端存檔與多裝置同步未出現在遠端。 | 無 | `discovered` |
| 內容 | 尚無新分支、新提交或 PR。`docs/content/` 不存在。 | 無 | `discovered` |

雲端代理「淡江世界遊戲內容」「後端存檔同步」在本輪盤點時為 RUNNING，尚未推送分支。不操作它們的工作區。

## 本輪範圍

把美術 M1 接到現有遊戲：沿用 `useRpg`／`useGame`、既有傷害與存檔，不另建生命、任務、背包或獎勵 store。
整合時修兩項會影響遊玩的缺陷：走路時頭部 Glance 累加，以及進出室內時骨架 bone texture 沒有釋放。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 美術 M1 與上述兩項修正，在整合分支 |
| 已驗證 | 本機 typecheck、217 項測試、靜態建置、省電畫質五段路線（SwiftShader，見 `VALIDATION.md`） |
| 已合併 | 否。PR #7 驗收已過、`mergeable_state` 為 clean，但合併 API 回 403，token 不能合併。沒有直接推 main |
| 已部署 | 否。本輪不部署 |

## 尚未完成的遊戲範圍

登入後的雲端同步、第二個測試客戶端、內容 schema、NPC 外觀、report／exam／final、其餘技能與場景精修，都還沒有可合併的實作。靜態版可以離線啟動；Node 登入與資料庫服務仍是既有程式，本輪沒有新的同步 API。
