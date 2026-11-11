# 整合狀態

更新：2026-11-11。`main` 是 `55eb7b9`。靜態建置可離線開到標題。遊戲程式仍是 `27e180c`。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 普攻是沿著身體從右掃到左的短光刃，不跟著 3.7 m 判定放大。九學院技能仍走各自的特效。 | [#21](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/21) 已合併，來源 `879ffdf` | `merged` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽與校園進入點都在 `main`。大門對話的獎勵寫進既有經驗、背包與 `claimed`。 | [#18](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/18) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

同一條遊玩：靜態站離線開局、選化學學系、走到大門、跟陳予說話、獎勵只進一次、既有普攻打到突襲小考、存檔重載、再用這份存檔做登入同步、第二客戶端、衝突、斷線與登出。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | `scripts/integration-route.mjs`，把三條線接成同一條可重跑的路線 |
| 已驗證 | 靜態站沒有打到 `/api/`。化學學系、經驗 20、筆記 19、`quest-orient-gate` 只記一次。第二次進入大門不再談。突襲小考 65→45。重載後經驗、筆記、科系還在。這份存檔第一次上傳 revision 1，第二客戶端下載到同一科系與經驗，同時寫入得到 200 與 `revision_conflict`，斷線時改動留在佇列，登出後讀取是 401。`pageErrors` 空 |
| 已合併 | 是。路線在 `5f7b6aa`。合併 API 403，`main` 未受保護，使用快轉推送。遊戲程式沒有改，仍是 `27e180c` |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。兩份科系目錄都還在。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。第二客戶端是雲端 API 客戶端，讀的是這次玩出來的存檔，不是手機上的第二個畫面。
