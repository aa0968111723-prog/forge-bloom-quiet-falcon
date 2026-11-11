# 整合狀態

更新：2026-11-11。`main` 是 `df63d01`。美術 M2 已合併。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | M2 已在 `main`：NPC 套件、`creature.report`／`exam`／`final`、八學院技能外形，加上 glance、暫停預警與單一骨架釋放。 | [#10](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/10) 已合併 | `merged` |
| 後端 | 草稿 PR [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9)，head `a38ef8e`。可選 RPG 雲端存檔、revision 衝突、只新增表的遷移。基底是美術 M1 之前的 `71f4d3c`。 | #9 草稿 | `discovered` |
| 內容 | `claude/tamkang-reality-campus-v1-2bxs0g` 已是 `main` 的祖先，沒有新提交。`docs/content/` 仍不存在。 | 無 | `discovered` |

雲端代理「淡江世界遊戲內容」「後端存檔同步」在本輪盤點時為 RUNNING，尚未推送分支。不操作它們的工作區。

## 本輪範圍

把美術 M2 接到已含 M1 與暫停預警修正的 `main`。戰鬥仍讀 `useRpg`，存檔 schema 沒有改。衝突只在資產卸載與主角 glance：保留剪輯姿勢還原，卸載改用美術線的 `releaseArtInstance`，刪掉重複的 `instance.ts`。

後端草稿 PR 本輪只登記，不與 M2 同一批合併。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 美術 M2：NPC 套件、三種怪物、學院技能外形 |
| 已驗證 | 合併前在 `be6fdd6`：typecheck、225 項測試、eslint 0、`build:site`、省電五段路線、report／exam／final 畫面。合併後在 `df63d01` 再跑 typecheck。SwiftShader，不是真機 |
| 已合併 | 是。`main` `df63d01261ad7d7a0e301b8bf91b1d6c473cbae3`。PR #10 已合併。合併 API 403，`main` 未受保護，使用快轉推送 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

雲端同步有草稿實作，還沒接到目前的 `main`，也還沒做第二客戶端驗收。內容 schema 仍沒有。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。
