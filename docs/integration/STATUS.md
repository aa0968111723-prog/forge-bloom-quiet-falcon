# 整合狀態

更新：2026-11-11。`main` 是 `6929508`。普攻光刃已合併，程式提交是 `27e180c`。合併後 typecheck 通過。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 普攻是沿著身體從右掃到左的短光刃，不跟著 3.7 m 判定放大。九學院技能仍走各自的特效。 | [#21](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/21) 已合併，來源 `879ffdf` | `merged` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽與校園進入點都在 `main`。大門對話的獎勵寫進既有經驗、背包與 `claimed`。 | [#18](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/18) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

普攻光刃跟著 0.46 秒攻擊片段，從角色右側移到左側，長度約前臂。判定半徑仍是 `attackFx.range`，畫面不跟著放大。有專屬特效的學院技能會關掉這道光刃。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 普攻光刃，`src/game/art/vfx/basic-swing.ts` |
| 已驗證 | typecheck、246 項測試。宮燈大道定步：蓄力幀刃在身體後側看不到，接觸與跟隨兩幀是短光刃並向左移，0.47 秒只剩很淡的殘光。化學技能仍是地面雙環，命中 1，`pageErrors` 空 |
| 已合併 | 是。程式是 `27e180c`，記錄隨 [#21](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/21) 快轉到 `6929508`。來源 `879ffdf` 已是 `main` 的祖先。合併 API 403，`main` 未受保護。合併後 typecheck 通過 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。雲端同步的第二客戶端是流程腳本驗的，不是手機操作。
