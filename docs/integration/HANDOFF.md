# 交接

最後更新：2026-11-11。從 `CHECKPOINT.json` 的 `next_action` 繼續。

## 現在

- 這次整合是狀態卡短標籤。來源 PR #24，`cursor/hud-status-1a71` @ `aeda26c`。接到 `origin/main` `b567b60`。
- 可見文字是「生命 62/108」。長句留在 `aria-label`。390×780 的目標卡在狀態卡下面。
- `npm run typecheck`、`npm test`（246）、`npm run build:site` 都通過。瀏覽器沒有 page error。

## 本輪已驗證（狀態卡）

在 `/tmp/worktrees/hud-status`。1280×720 與 390×780 都讀到短標籤，生命從 62 改成 20 後標籤與填色一起變。窄視窗目標卡上緣 208，狀態卡下緣 188。主機是 SwiftShader。

## 下一步

先確認 `origin/main` 仍是 `b567b60`、來源 head 仍是 `aeda26c`，再快轉。快轉之後下一次先 `git fetch`。這次只改讀數，不要為了它重跑跨系統路線。遊戲程式 SHA 會離開 `27e180c`。

INT-01 與 INT-12 維持不動。不要新增學期選擇，也不要做第二套獎勵帳。ART-090 剩下技能圖示、地圖標記、受擊回饋。

## 不要做

正式部署、開通付費、正式資料庫遷移、刪玩家資料、強推、繞過保護、自批自己的必要 review。M1 不是整款遊戲完成。
