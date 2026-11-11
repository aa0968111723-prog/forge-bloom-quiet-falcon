# 整合狀態

更新：2026-11-11。校園門口步道改接到估計路網上能站的點。遊戲程式在這次合併。同一棵樹再走完跨系統路線：經驗 20、筆記 19、突襲小考 65→45、第二客戶端、`revision_conflict`、登出 401。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 每個校園門口的步道走到估計路網上能站的點。視聽教育館與正門不再穿進量體。狀態卡仍是短標籤。精度仍是 estimated。 | [#27](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/27)，來源 `f48a2c5` | `integrating` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽與校園進入點都在 `main`。大門對話的獎勵寫進既有經驗、背包與 `claimed`。 | [#18](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/18) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

校園門口步道。41 個門口從門口走到路網上碰撞允許站立的點。視聽教育館與正門的步道沿量體外側接到路。路網仍是估計格網，沒有新的階數。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | `entranceRoadPath` 取代對準最近垂直線的步道 |
| 已驗證 | `npm run typecheck` 通過。`npm test` 248 通過，其中門口步道 2 通過。`npm run build:site` 通過。瀏覽器定步：視聽教育館與正門的步道沿牆外側接到路，`pageErrors` 空。同一版跨系統路線：化學學系、經驗 20、筆記 19、任務一次、突襲小考 65→45、重載、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401 |
| 已合併 | 進行中。來源 PR #27 `f48a2c5`。衝突用手解，狀態卡與門口步道的記錄都留下 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。兩份科系目錄都還在。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。ART-090 還沒做技能圖示、地圖標記與受擊回饋。第二客戶端是雲端 API 客戶端，不是手機上的第二個畫面。
