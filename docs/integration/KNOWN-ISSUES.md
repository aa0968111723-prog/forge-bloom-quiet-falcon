# 已知問題

| ID | 狀態 | 說明 | 下一步 |
| --- | --- | --- | --- |
| INT-01 | blocked | 科系仍有兩份清冊：`src/game/departments.ts` 與 `src/game/rpg/data.ts`。查詢把化學系和數學系的兩個名字當別名，存檔仍用 RPG id。 | 等內容線指定唯一 id。在那之前不刪任何一邊 |
| INT-02 | 已處理 | 雲端存檔與第二客戶端已在 `main`。學期這版又走一次：上傳、下載、衝突、斷線、登出都通過，第二客戶端看得到期中 | 遊戲程式沒再變就不要重跑 |
| INT-03 | 已處理 | 走路／跑步時 idle 權重為 0，walk／run 沒有 `head` 軌，glance 用 `+=` 會把頭越轉越偏。Codex 在 PR #6 的意見 | `look.ts` 先還原上一幀剪輯姿勢再加一次 glance。測試：`scripts/art-runtime.test.mjs` |
| INT-04 | 已處理 | 複製骨架在卸載時要釋放 bone texture。M2 美術線改成 `releaseArtInstance`，與整合線的 `disposeOwnedArt` 衝突 | 只留 `releaseArtInstance`。刪 `src/game/art/instance.ts`。測試改呼叫它，共享幾何仍不釋放 |
| INT-05 | needs_review | 美術線 KI-03、KI-17：鞋頭偏扁、手為連指；頂着高台時速度被歸零所以播 idle | 留在美術線下一項。本輪不改移動規則 |
| INT-06 | pending-device | 手機與 RTX 3060 沒有量測 | 有裝置再量。不填估計 FPS |
| INT-07 | discovered | 儲存庫沒有會擋合併的 GitHub Actions。保護規則端點對此 token 是 403，branches API 顯示 main 未保護 | 若之後出現必須的 check，要等那個 check 真正通過才能合併 |
| INT-08 | 已處理 | 合併 API 持續 403。`main` 仍未受保護、也沒有必須的 GitHub check，所以 PR #7 與 #8 都用非快轉合併推進，沒有強推 | 一旦出現保護規則或必須的 check，就停在 PR，不再直接推 main |
| INT-09 | 已處理 | 考卷怪 windup 在面板或告示暫停時仍每幀前進，恢復後預警維持滿圈。Codex 在已合併的 PR #7 上提出 | `nextWindupProgress` 在模擬暫停時停住。PR #8，合併 `d180616`。M2 把 `QuizCreature` 改名 `CreatureActor` 時自動合併仍呼叫它 |
| INT-10 | discovered | 後端契約把 `contentVersion: 2` 用來表示 RPG 存檔 `document.version`。內容敘事用的是 manifest `revision: 1`，沒有 `contentVersion` | 對照時分開記。不要把雲端的 2 當成敘事包版本 |
| INT-12 | 已處理 | 主存檔的學期跟既有 `claimed` 走。大門任務和補給委託都領取後是期中，再加上戰鬥任務 `first` 才是期末。預覽頁的 fixture 仍只服務 `/narrative`。`MAIN_INTEGRATION` 仍是 false | 不要把 fixture 接到主存檔。主畫面沒有學期選擇器 |
| INT-11 | 已處理 | 開發模式 strict mode 會把 NPC `assemble` 跑兩次。第一次已拿掉零件，第二次就丟「lists a part the kit does not have」，`ArtBoundary` 改畫程序學生 | `assemble` 若已有 `npc:<preset>` 就沿用那一個 mesh。測試：`scripts/art-runtime.test.mjs` |
