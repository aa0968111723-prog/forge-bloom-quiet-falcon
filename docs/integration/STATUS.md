# 整合狀態

更新：2026-11-11。大門與大忠警衛站改成兩根門柱加橫樑，中間可以走，碰撞只在門柱。同一版再走完跨系統路線：經驗 20、筆記 19、突襲小考 65→45、第二客戶端、`revision_conflict`、登出 401。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 大門與大忠警衛站是開口門柱，路從中間過，碰撞只在門柱。狀態提示仍在長條外面換行。精度仍是 estimated。 | 來源 `d930724` | `merged` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽與校園進入點都在 `main`。大門對話的獎勵寫進既有經驗、背包與 `claimed`。 | [#18](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/18) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

軸線上的兩座警衛站。大門與大忠警衛站不再是擋路的實心塊，改成兩根門柱加橫樑。人可以站在開口裡。碰撞只在門柱。外形仍是 estimated，不是實測門寬。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | `kind: "gate"` 與 `gatePiers`。門柱寬 1.5 |
| 已驗證 | `npm run typecheck` 通過。`npm test` 249 通過，其中 `scripts/axis-gates.test.mjs` 通過：兩座站的中心半徑 0.6 m 不被推開，門柱中心會被推開。`npm run build:site` 通過。瀏覽器 1280×720：人站在兩根紅柱與綠瓦橫樑中間，路從開口穿過，`pageErrors` 空。同一站跨系統路線：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401 |
| 已合併 | 是。遊戲程式在 `df17317`。來源 `d930724`。`main` 未受保護、沒有必須的 check，使用快轉 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。兩份科系目錄都還在。白樓、覺軒與其餘分區仍是既有量體，還沒有遠距 LOD。手機與 RTX 3060 是 `pending-device`。ART-090 還沒做技能圖示、地圖標記與受擊回饋。第二客戶端是雲端 API 客戶端，不是手機上的第二個畫面。
