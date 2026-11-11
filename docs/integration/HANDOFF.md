# 交接

最後更新：2026-11-11。從 `CHECKPOINT.json` 的 `next_action` 繼續。

## 現在

- 這次整合讓雨後預設在戶外下雨，條數跟畫質。遊戲程式是 `5f2ce19`，接到 `origin/main` `a815666`。
- 高畫質 320 條，低畫質 64 條。室內不畫。減少動態時雨絲停住。
- 跨系統路線在同一站通過：經驗 20、筆記 19、突襲小考 65→45、第二客戶端、`revision_conflict`、斷線佇列 `cloudXp` 23、登出 401。`pageErrors` 空。

## 本輪已驗證（雨）

`scripts/art/capture-art.mjs` 的 `rain` 在 `http://127.0.0.1:8110/`。高畫質 1280×720、低畫質 1280×720、高畫質 390×780 都是 `pageErrors` 空。`node --experimental-transform-types scripts/integration-route.mjs` 走完同一站。`npm test` 260 通過。幀時間是 SwiftShader。

## 下一步

先開整合 PR，再合併。來源 `7f9fbe4` 的程式已在這次 cherry-pick，那個 SHA 不是祖先，不要單獨合併 PR #61。PR #59、#56、#54、#53、#51 的程式已經在更早的整合裡，也不要再單獨合併。PR #32 的 `1fc5887` 仍不合併。

合併之後先 `git fetch`。遊戲程式沒有再變就不要重跑跨系統路線，也不要為了對齊 SHA 再寫一筆。三角形仍用 `7507c59` 那次重測。

INT-01 與 INT-12 維持不動。不要新增學期選擇，也不要做第二套獎勵帳。

## 不要做

正式部署、開通付費、正式資料庫遷移、刪玩家資料、強推、繞過保護、自批自己的必要 review。M1 不是整款遊戲完成。
