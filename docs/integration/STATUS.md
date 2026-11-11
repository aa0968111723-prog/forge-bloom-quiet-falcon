# 整合狀態

更新：2026-11-11。視聽教育館改成深色廳堂加舞台塔。文學館仍是坡頂。傳播館留著。幀時間仍是 SwiftShader。
本文件只記實際程式、PR 與本輪驗收。不把 M1 或 M2 當成整款遊戲完成，也不以 PR 或文件數量估算完成率。

## 三條線

| 線 | 目前成果 | 開放 PR | 狀態 |
| --- | --- | --- | --- |
| 美術與場景 | 視聽教育館是深色廳堂加舞台塔。文學館仍是坡頂。傳播館仍是深色基座加天線。 | 來源 PR #73 `8517cae`。整合分支 `cursor/integration-auditorium-3395` | `verified` |
| 後端 | 可選 RPG 雲端存檔已在 `main`。未登入只寫本機。第一次上傳要明示。衝突回 `revision_conflict`，由玩家選保留雲端或本機。靜態產物不含這套 API。 | [#9](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/9) 與 [#13](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/13) 已合併 | `merged` |
| 內容 | `/narrative` 預覽與校園進入點都在 `main`。大門對話的獎勵寫進既有經驗、背包與 `claimed`。 | [#18](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/18) 已合併 | `merged` |

不操作其他代理正在改的工作區。

## 本輪範圍

文藝區的 `audiovisual` 改成 `auditorium`。深色廳堂、屋頂一端舞台塔。共用窗帶仍畫。文學館仍是坡頂。傳播館留著。舞台塔不是實測。精度仍是 estimated。戰鬥、獎勵、科系目錄與學期沒有改。

## 路線

| 項目 | 狀態 |
| --- | --- |
| 已製作 | 只改視聽教育館的量體。文學館、傳播館、麗澤、風洞、司令臺、會議中心與覺生綜合大樓留著 |
| 已驗證 | 靜態頁 `http://127.0.0.1:8118/`。1280×720 與 390×780 都看得到深色廳堂、舞台塔和「視聽教育館」。兩次 `pageErrors` 空。跨系統路線再次通過 |
| 已合併 | 尚未。遊戲程式 `b805fae`。接到 `origin/main` `3b4498a`。`main` 未受保護、沒有必須的 check |
| 已部署 | 否 |

## 尚未完成的遊戲範圍

學期階段仍固定在 `week-1`，玩家不能在主畫面改期中或期末。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。兩份科系目錄都還在。手機與 RTX 3060 是 `pending-device`。第二客戶端是雲端 API 客戶端，不是手機上的第二個畫面。
