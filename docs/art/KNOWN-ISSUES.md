# 已知問題

更新：2026-11-11。`needs_review` 表示已在主遊戲運作但待美術審閱或精修；`blocked` 表示外部受阻。

| ID | 範圍 | 狀態 | 說明 | 下一步 |
| --- | --- | --- | --- | --- |
| KI-01 | 效能 | 已處理 | 新主角 20.9k 三角形讓本主機省電畫質室內 frame median 33.3 → 50 ms。已加 LOD1（9.1k）於省電畫質使用，重測回到 33.3／50 ms（STATUS.md）。 | NPC 套用角色組時沿用 LOD 規則 |
| KI-02 | 傳輸 | needs_review | 省電畫質未壓縮傳輸 +0.8 MB（主角 LOD1 0.62 MB、考卷怪 0.17 MB）；高畫質 +1.3 MB。vite preview 未 gzip。 | 依量測評估 meshopt／KTX2（ART-015）；部署端確認 gzip |
| KI-03 | 主角外觀 | needs_review | 鞋楦已加高並加圓頭與橡膠鞋頭，手指已分開；四肢仍偏細，待審閱。 | 審閱 `evidence/m2/protagonist-shoes-hands.jpg` |
| KI-04 | 樣板場景 | needs_review | 宮燈大道沿用既有建物與宮燈；未依新方向精修碧瓦、窗格與宮燈燈頭。 | 併入 axis-54（ART-062） |
| KI-05 | 怪物 | needs_review | quiz／report／exam／final 都改由管線模型繪製，數值與 AI 未改。final 空地正面與背面見 `creature-final-open.jpg`；側面仍會被近處樹冠擋住。 | 審閱 `evidence/m2/creature-*` |
| KI-06 | 技能 | needs_review | 九學院都有專屬特效並跟隨 `attackFx` 範圍與命中。施放姿勢仍是同一套。商管金幣在單一目標上會疊成一串。 | ART-032 各學院施放姿勢；金幣散開 |
| KI-07 | 判定時序 | 設計限制 | `attack()` 同一幀完成扣血，技能沒有可延後的「預備」；預備以冷卻結束的就緒提示呈現，命中特效從 t = 0 開始。 | 若要真正的前搖需改戰鬥規則，超出美術範圍 |
| KI-08 | 預警形狀 | 設計限制 | 敵人攻擊判定是圓形（`radius + 2.5`），因此預警只能是圓；不畫錐形或直線以免誤導。 | 若改判定再改圖 |
| KI-09 | UI | planned | HUD 狀態卡顯示「生命 目前值 100 最大值 100 變化 目前 0 最大 0」純文字讀數。 | ART-090 |
| KI-10 | 標題 | planned | 標題鏡頭右側有大塊米色遮擋幾何。 | 查明來源物件後修正 |
| KI-11 | 效能預算 | planned | 改造前就存在：高畫質戶外 2.74 M 三角形，超過 `reality-regression.mjs` 的 1.6 M。 | ART-102 |
| KI-12 | 量測 | blocked | 無手機與 GPU；所有手機／桌面目標 `pending-device`。 | ART-101 |
| KI-13 | 音效 | blocked | 沒有有授權的音檔來源。 | ART-092 |
| KI-14 | 來源 | blocked | 任務包與核准概念圖不在儲存庫，風格只能依文字規格比對。 | 取得概念圖後比對 |
| KI-15 | Lint | 既有 | `src/` 既有 6 個 ESLint 錯誤（AdventureHud、prompts、rules×3、semester/track）；本次新增程式 0 錯誤；`work/` 已加入 ignore。 | 觸及該檔時修正 |
| KI-16 | 截圖 | 工具限制 | 本主機每幀 0.4–4 s，捕捉快速特效需 `?qa=1` 的定步時鐘（freeze/step），否則截圖時效果已結束。 | 已在 capture-art 使用 |
| KI-17 | 主角／控制 | needs_review | 按住移動但台基把速度歸零時，動畫改播約 45% 意圖速度的原地步伐（`strideRef`）；物理速度仍為 0。尚未重錄迴廊台基那段。 | 補一段對著台基按住 W 的畫面 |
| KI-18 | 攝影機 | 既有 | 宮燈教室迴廊內，跟隨攝影機被柱子推近，接近的怪物會貼近畫面（錄影 0:47–0:50）。 | 環境階段檢查迴廊碰撞與攝影機半徑 |
| KI-19 | 主角動畫 | 已處理 | 走路與跑步片段沒有頭部軌，idle 在超過 2.2 m/s 後權重為 0，注視用 `+=` 會逐幀扭頭。已在 mixer 前恢復綁定旋轉。測試：衝刺 90 幀後頭部仍停在單次注視角。 | 無 |
| KI-21 | 舊巡禮 | 已處置 | `src/game/Enemies.tsx` 只被沒有路由的 `CampusGame` 使用。正式遊戲是 `AdventureApp`。保留舊程式，不當作缺模型。 | 無 |
