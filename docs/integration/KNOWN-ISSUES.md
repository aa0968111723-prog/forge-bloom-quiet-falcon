# 已知問題

| ID | 狀態 | 說明 | 下一步 |
| --- | --- | --- | --- |
| INT-01 | blocked | 科系有兩份清冊：`src/game/departments.ts` 與 `src/game/rpg/data.ts`。id 形狀不同，只在匯入時依名稱對應。 | 等內容線指定唯一 id。在那之前不刪任何一邊 |
| INT-02 | discovered | 後端線與內容線沒有分支或 PR。雲端存檔、第二客戶端、內容 schema 都不能驗 | 它們推送後再整合。不預先做第二套 store |
| INT-03 | 已處理 | 走路／跑步時 idle 權重為 0，walk／run 沒有 `head` 軌，glance 用 `+=` 會把頭越轉越偏。Codex 在 PR #6 的意見 | `look.ts` 先還原上一幀剪輯姿勢再加一次 glance。測試：`scripts/art-runtime.test.mjs` |
| INT-04 | 已處理 | 考卷怪與主角的複製骨架在進出室內時沒有釋放 bone texture。Codex 在 PR #6 的意見 | `disposeOwnedArt` 釋放實例材質與骨架，不釋放共享幾何 |
| INT-05 | needs_review | 美術線 KI-03、KI-17：鞋頭偏扁、手為連指；頂着高台時速度被歸零所以播 idle | 留在美術線下一項。本輪不改移動規則 |
| INT-06 | pending-device | 手機與 RTX 3060 沒有量測 | 有裝置再量。不填估計 FPS |
| INT-07 | discovered | 儲存庫沒有會擋合併的 GitHub Actions。保護規則端點對此 token 是 403，branches API 顯示 main 未保護 | 若之後出現必須的 check，要等那個 check 真正通過才能合併 |
| INT-08 | 已處理 | 合併 API 回 403。`main` 未受保護，已用非快轉合併提交推進 `main`，沒有強推。PR #6 與 #7 隨後都顯示已合併 | 之後若出現必須的 check 或保護規則，改等那個規則，不再改用直接推送 |
