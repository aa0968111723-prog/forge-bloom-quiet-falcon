# 整合狀態

更新：2026-11-11。狀態卡短標籤已在 `main`，遊戲程式是 `803fe62`。同一版又走完跨系統路線：經驗 20、筆記 19、突襲小考 65→45、第二客戶端、`revision_conflict`、登出 401。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 狀態卡寫「生命 62/108」這種短標籤，長句留在 `aria-label`。普攻仍是從右掃到左的短光刃。 | [#24](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/24) 與 [#26](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/26)，來源 `aeda26c` | `merged` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽與校園進入點都在 `main`。大門對話的獎勵寫進既有經驗、背包與 `claimed`。 | [#18](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/18) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

同一條遊玩跑在帶短標籤狀態卡的遊戲上：離線開局、化學學系、大門對話、獎勵一次、既有普攻、存檔重載、登入同步、第二客戶端、衝突、斷線與登出。對話打開時狀態卡可見文字是「生命 100/100」「專注 100/100」。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 路線腳本沒有改。這次只在遊戲程式 `803fe62` 上重跑 |
| 已驗證 | `http://127.0.0.1:8087/?qa=1&q=low`。化學學系 `science-理學院-2`，經驗 20，筆記 19，`quest-orient-gate` 只記一次。第二次進入大門進室內，經驗仍是 20。突襲小考 65→45。重載後科系、經驗、筆記都在。離線過程沒有 `/api/` 請求。第一次上傳 revision 1，第二客戶端下載到同一科系與經驗，同時寫入 200 與 `revision_conflict`，斷線改動留在佇列，登出後讀取是 401。`pageErrors` 空 |
| 已合併 | 遊戲程式已在 `main`。這筆記錄隨這次驗收一起送 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。兩份科系目錄都還在。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。ART-090 還沒做技能圖示、地圖標記與受擊回饋。第二客戶端是雲端 API 客戶端，不是手機上的第二個畫面。
