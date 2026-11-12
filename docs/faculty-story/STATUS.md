# 教授、主任與角色劇情

本線擁有 `src/features/faculty-story/**`、`docs/faculty-story/**` 和 `scripts/faculty-story.test.mjs`。

儲存庫裡沒有 AGENTS.md。沒有另寫一份。

十二名角色都是虛構的。沒有使用真人姓名或職稱。科系 id 沿用 `departments.ts`。學期仍是 week-1，本線沒有學期條件。

主遊戲入口是走到角色、按「與某人交談」。不是只在獨立預覽頁。獎勵走既有 `grantQuestReward`。`MAIN_INTEGRATION` 仍是 false。

主線「評圖留白」在 SwiftShader、1280×720 的腳本實測是 18.08 分鐘。這不是手機，也不是 RTX 3060。站點是估計位置。

簡禾與江照的認識選擇會改簡衡轉折的開場。同一台機器、同一解析度下，兩條路的主遊戲對話都已截圖。顧衡的待機、交談與交付都用既有角色組：待機沒有單次動作，交談和交付都播 `interact`。

細節見 CAST.md、VALIDATION.md、ID-REQUEST.md、CHECKPOINT.json。
