# 整合狀態

更新：2026-11-11。驚聲廣場的環形樹避開標題鏡頭 16 m，銅像、廣場和宮燈教室不再被前景樹冠擋住。48 m 樹冠切換、七區地圖、技能圖示、受擊邊緣與開口門柱留著。同一版再走完跨系統路線：經驗 20、筆記 19、突襲小考 65→45、第二客戶端、`revision_conflict`、登出 401。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 標題鏡頭旁的廣場榕樹已讓出 16 m。48 m 樹冠切換、七區地圖、技能圖示、受擊邊緣、教學樓量體與開口門柱仍在。 | 來源 `eab68c7` | `merged` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽與校園進入點都在 `main`。大門對話的獎勵寫進既有經驗、背包與 `claimed`。 | [#18](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/18) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

標題鏡頭。廣場環形樹在 `TITLE_ORBIT`（-13, 13）16 m 內不再種。杜鵑花環留著。48 m 樹冠切換留著。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 廣場環形樹避開標題鏡頭 16 m |
| 已驗證 | `npm run typecheck` 通過。`npm test` 255 通過。`npm run build:site` 通過。高畫質 1280×720 與 390×780 的標題畫面都看得到廣場與宮燈，前景沒有擋滿的樹冠。`pageErrors` 空。同一站跨系統路線：經驗 20、筆記 19、任務一次、突襲小考 65→45、revision 1、第二客戶端、`revision_conflict`、斷線佇列、登出 401 |
| 已合併 | 是。遊戲程式在 `adfd28a`。來源 `eab68c7`。整合 PR #48。`main` 未受保護、沒有必須的 check |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。兩份科系目錄都還在。手機與 RTX 3060 是 `pending-device`。第二客戶端是雲端 API 客戶端，不是手機上的第二個畫面。
