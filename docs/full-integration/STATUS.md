# 全專案統整狀態

更新：2026-11-12T01:22:56Z。本文件只記這條統整線自己的程式、檢查與阻塞。不把文件或 PR 數量當成完成率。`AGENTS.md` 不存在，沒有另寫一份。

## 誰能寫 main

原整合線仍在跑：雲端代理 `bc-4054e39b-9fa6-4a4b-a25e-e1ee4a333395`（五虎崗遊戲整合），分支 `cursor/integration-art-m1-3395`，狀態 RUNNING。它是目前唯一在寫 `main` 的人。這條線不合併、不 force push、不改 `docs/integration/**`、不停止對方。GitHub 靜默不當成對方已停。

這條線的分支是 `cursor/integration-full-game-f7e4`。遊戲程式 `90768e40afcba821de2650955ee903b06b34cb73`。放置與裝備的 store 檢查 `9c45f10509867c9bde1aa9a95e2e85f167a87e20`。基線 `origin/main` `4b88b772d4e21424dd14b502655c1239b1abd8bf`（整合 PR #120，外國語文大樓）。

另外三條功能線當時也是 RUNNING，而且還沒有分支：道具裝備建造 `bc-a35a625b-d62e-4fae-b03d-3e5a0a9615c5`、玩法遭遇系統 `bc-cc86f026-f89d-4206-a955-4aadf0dbfb95`、教職員角色故事 `bc-8a8789a5-af55-45d8-a871-00b485d975f5`。它們的工作區沒有被改寫。

## 這條線交付了什麼

| 項目 | 已實作 | 已接線 | 已驗證 | 已合併 | 已部署 |
| --- | --- | --- | --- | --- | --- |
| 兩份科系目錄的單一查詢 | 是。`src/game/contracts/departments.ts`。有 RPG 列時以 RPG id 為準，短 id 與兩個系名是別名 | 是。`resolveCatalogDepartmentId`、`knownDepartment`、`legacyDepartment` 都走這份查詢 | 是。`scripts/full-integration-contracts.test.mjs`。化學學系對到 `chemistry` / `science`。`med-info` 沒有 RPG 列 | 否 | 否 |
| 學期來源 | 是。`SEMESTER_SOURCE = contracts.semester`。只看 `claimed`，不看電腦日期 | 是。讀檔、匯入、對話、領取、補給、合法放置都會蓋上學期。`MAIN_INTEGRATION` 仍是 false | 是。單元測試含期末。主遊戲路線看到第一週進期中 | 否 | 否 |
| 校園委託一次結算 | 是。`quest-errand-campus-post`，經驗 12、筆記 2，寫進既有背包與 `claimed` | 是。補給成功或合法放置。非法放置與取消建造不結算 | 補給：主遊戲路線。放置、非法、取消、徽章裝備：同一份 live store，不是瀏覽器 | 否 | 否 |
| 主遊戲路線 | 既有大門對話、戰鬥、存讀檔、雲端客戶端仍在 | 補給之後學期改為期中，狀態卡寫「期中 · 擊退三隻異象」 | 是。見 VALIDATION.md。靜態頁不含雲端 API 字串 | 否 | 否 |
| 既有美術到外國語文大樓 | 在 `main`，不是這條線做的 | 不適用 | 他人紀錄：整合 PR #120 | 他人已合併 | 否 |
| 九學院技能、四類怪物、七區路網、真機效能 | 既有程式還在，這輪沒有重做 | 不適用 | 這輪沒有逐項重跑 | 否 | 否 |

存檔鍵仍是 `tamkang-rpg-v2`，快照版本仍是 2。沒有第二套貨幣、背包或 claimed。舊檔沒有新委託 id 時留在第一週。敘事裡殘留的 `finals` 會依 `claimed` 蓋回，經驗和物品不另開帳。

## 還沒接到主遊戲畫面的部分

合法放置、非法放置、取消建造、徽章裝備只在 live store 檢查通過。期末要期中之後再領既有戰鬥任務 `first`，單元測試有，主遊戲路線沒有打完三隻再結算。手機粗指標 HUD 與 RTX 3060 仍是 pending-device。校園位置仍是 estimated。
