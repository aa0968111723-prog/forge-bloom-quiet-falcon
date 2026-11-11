# 交接

最後更新：2026-11-11。從 `CHECKPOINT.json` 的 `next_action` 繼續。

## 現在

- 這次整合把窄畫面的工具鈕與快捷圖示放大。遊戲程式是 `d8f6df9`，接到 `origin/main` `ea5aef4`。
- 390×780 量到工具鈕 44×44、快捷圖示 24×24。1280×720 的工具鈕仍是 42×42、技能圖示 21×21。
- 跨系統路線在同一站通過：經驗 20、筆記 19、突襲小考 65→45、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 本輪已驗證（手機圖示）

`scripts/art/capture-art.mjs` 的 `phone` 在 `http://127.0.0.1:8109/`，高畫質。`node --experimental-transform-types scripts/integration-route.mjs` 走完同一站。`npm test` 259 通過。幀時間是 SwiftShader。

## 下一步

先開整合 PR，再合併。來源 `2b8f9fb` 的程式已在這次 cherry-pick，那個 SHA 不是祖先，不要單獨合併 PR #59。PR #56、#54、#53、#51 的程式已經在更早的整合裡，也不要再單獨合併。PR #32 的 `1fc5887` 仍不合併。

合併之後先 `git fetch`。遊戲程式沒有再變就不要重跑跨系統路線，也不要為了對齊 SHA 再寫一筆。三角形仍用 `7507c59` 那次重測。

INT-01 與 INT-12 維持不動。不要新增學期選擇，也不要做第二套獎勵帳。

## 不要做

正式部署、開通付費、正式資料庫遷移、刪玩家資料、強推、繞過保護、自批自己的必要 review。M1 不是整款遊戲完成。
