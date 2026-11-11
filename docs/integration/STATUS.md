# 整合狀態

更新：2026-11-11。狀態卡可見文字改成短標籤長條。上一條跨系統路線仍描述 `27e180c` 的遊玩；這次只改讀數，沒有重跑那條路線。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 狀態卡寫「生命 62/108」這種短標籤，長句留在 `aria-label`。普攻仍是從右掃到左的短光刃。 | [#24](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/24) 與 [#26](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/26)，來源 `aeda26c` | `merged` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽與校園進入點都在 `main`。大門對話的獎勵寫進既有經驗、背包與 `claimed`。 | [#18](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/18) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

狀態卡的生命、專注、經驗。可見文字是短標籤，輔助文字仍是「目前值／最大值／變化」。390px 寬時目標卡移到狀態卡下方。技能圖示、地圖標記、受擊回饋不在這次。

## 標示

| 項目 | 狀態 |
| --- | --- |
| 已製作 | `BarReadout.short`，狀態卡長條改畫短標籤，窄視窗目標卡 `top: 208px` |
| 已驗證 | `npm run typecheck` 通過，`npm test` 246 通過，`npm run build:site` 通過。瀏覽器 1280×720 與 390×780：可見文字是「生命 62/108」「專注 40/100」「經驗 20/180」，不含「目前值」；`aria-label` 仍有目前值與最大值。生命改成 20 後標籤變成「生命 20/108」，填色寬度跟著變。390px 時目標卡上緣 208、狀態卡下緣 188，沒有蓋住。`pageErrors` 空 |
| 已合併 | 是。遊戲程式在 `803fe62`。來源 `aeda26c`。合併 API 仍 403，`main` 未受保護、沒有必須的 check，使用快轉 |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。兩份科系目錄都還在。七區建築仍是既有場景。手機與 RTX 3060 是 `pending-device`。ART-090 還沒做技能圖示、地圖標記與受擊回饋。第二客戶端是雲端 API 客戶端，不是手機上的第二個畫面。
