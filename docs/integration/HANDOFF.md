# 交接

最後更新：2026-11-11。從 `CHECKPOINT.json` 的 `next_action` 繼續。

## 現在

- 這次整合是商管大樓改成教學樓基座。來源 `cursor/business-mass-1a71` @ `70dd633`。接到 `origin/main` `3950e2a`。
- `business-building` 是 `study-block`，精度仍是 estimated。標題鏡頭與 48 m 樹冠切換留著。
- 同一版 `http://127.0.0.1:8104/` 再走完跨系統路線：經驗 20、筆記 19、突襲小考 65→45、第二客戶端、`revision_conflict`、登出 401。

## 本輪已驗證（商管大樓）

`npm run typecheck` 通過。`npm test` 255 通過。`npm run build:site` 通過。高畫質 1280×720 與 390×780 的 `pageErrors` 都是空。

## 下一步

先 `git fetch`。商管大樓已在 `main`，遊戲程式是 `79515b6`。遊戲程式沒再變就不要重跑路線，也不要為了對齊 SHA 再寫一筆。PR #32 的 `1fc5887` 仍不合併。整合 PR 是 #50。來源 PR #49 的程式已在這次整合裡，不要再單獨合併那支舊基線。

INT-01 與 INT-12 維持不動。不要新增學期選擇，也不要做第二套獎勵帳。

## 不要做

正式部署、開通付費、正式資料庫遷移、刪玩家資料、強推、繞過保護、自批自己的必要 review。M1 不是整款遊戲完成。
