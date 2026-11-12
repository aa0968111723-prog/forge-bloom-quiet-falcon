# 驗收

## 這次親自跑過

| 檢查 | 結果 |
| --- | --- |
| `node --test scripts/faculty-story.test.mjs` | 8 通過 |
| `npm test` | 274 通過，exit 0。這是本機測試，不是 CI |
| `npm run typecheck` | exit 0 |
| 主遊戲 1280×720 | 開始學期 → 建築學系 → 建築系館外與顧衡交談 → 選「我先補剖面」→ 經驗 12 變 34，claimed 為 quest-faculty-gu-meet 與 quest-faculty-studio-meet → 繼續自由探索 → 重新載入 → 繼續學期 → 同一位置台詞變成「顧衡把你補上的剖面壓在模型旁」，經驗仍是 34 |
| 390×780 | `#narrative-scroll` overflow auto，scrollHeight 349、clientHeight 312，捲動後看得到「離開，不結算」。`#narrative-close` 44×44，點了之後面板關閉 |
| 主線時長 | 2026-11-12，從進入學期到梁晚最後一段，牆鐘 18.08 分鐘。直線以遊戲步行 4.6 m/s 分段前進，每段開場停留 12 秒、結果停留 8 秒。記錄在這次執行的 `faculty-play-log.json` |

Renderer：`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`。

解析度：桌面證據 1280×720，手機版面證據 390×780。瀏覽器是這台機器的 Google Chrome。SwiftShader 與窄視窗不是手機，也不是 RTX 3060。

畫面：

- 顧衡站在建築系館外，名牌、眼鏡、深色開襟、圖筒。經驗 34/60。
- 對話有「虛構角色 · 教授 · 建築學系」和兩個選項。
- 重載後的開場引用先前的剖面選擇。
- 窄視窗可捲動、可關閉。

## 腳本步行怎麼算時間

角色之間用直線分段，每秒約 4.6 公尺，不是鍵盤繞開建築物的路徑。直線比繞路短。18.08 分鐘已經含載入、步行和對話停留。沒有用字數換算時長。

## 沒有親自當成通過的項目

沒有 CI 紀錄。沒有手機裝置。沒有獨立顯示卡。校園座標沒有實測。期中與期末沒有觸發。
