# 驗收

只記錄本輪在整合工作區實際跑過的結果。畫面數字來自主機 SwiftShader，不是手機或桌面 GPU。

整合分支含美術 PR #6（`017b755`）與頭部 glance、骨架釋放修正。

## 自動檢查

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm test` | 217 通過 / 0 失敗（美術線 215，另加 glance 不累加、骨架釋放且不釋放共享幾何） |
| `npx eslint`（本次改動的 `src/game/art` 與 `scripts/art-runtime.test.mjs`） | 0 錯誤 |
| `npm run build:site` | 通過。既有 >500 kB chunk 提示仍在。`AdventureApp` 約 578 kB |

`npm test` 內含美術驗證器與位元組重建檢查。沒有刪測試。

儲存庫沒有 GitHub Actions。`main` 的 branches API 回報 `protected: false`。分支保護端點對此 token 為 403，rulesets 清單是空的。CodeRabbit 在 PR #6 為 skipped。本機結果不能冒充 GitHub check；目前也沒有必須通過的 check。

## 行為路線（靜態預覽）

`npm run preview:site` 後實際執行：

`PW_CHROMIUM_PATH=/usr/bin/google-chrome ROUTE_SAMPLE_MS=800 node scripts/art/capture-route.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/art-m1-route --tier low --label integration-low`

結果已放進 `docs/integration/evidence/`。

主機：4 vCPU，WebGL 為 SwiftShader。視窗 844×390，`?qa=1&q=low`。`pageErrors` 為空。

| 段落 | 觀察 |
| --- | --- |
| 標題 | 可操作。frame median 441.65 ms（本機，非目標裝置） |
| 戶外 | 進入學期，科系為土木工程學系，宮燈大道場景在 |
| 戰鬥 | `quiz-2` 生命 65 → 25，狀態 chase；畫面上「結構脈衝 · 命中 1 個目標」，技能冷卻 6 秒。玩家生命 100 |
| 室內 | `enter("palace")` 後宮燈教室 1 樓，可見新主角後腦（深色束髮）。draw calls 11，三角形 12352 |
| 返回戶外 | `exit()` 後回到宮燈教室入口，角色仍在，提示「進入宮燈教室」 |

傳輸 51 個資源、約 2.35 MB 未壓縮，其中 GLB 2 個。與美術線省電路線的傳輸量同一量級。

截圖：`docs/integration/evidence/integration-low-1-title.png` 到 `integration-low-5-outdoor-return.png`。原始數字：`integration-low.json`。

## 本輪沒有驗的項目

這些功能還沒有新的實作，不使用假資料填成完成：

- 主動登入、雲端同步、第二個客戶端、同步衝突
- 內容版本不相容
- report／exam／final 新外形、NPC 角色組、其餘八學院技能
- 手機與 RTX 3060：`pending-device`。不填估計 FPS
- reduced-motion 技能截圖（程式路徑沿用美術線，本輪沒有另拍）
- Node 版資料庫服務沒有新的遷移或同步 API，沒有另開資料庫驗收
