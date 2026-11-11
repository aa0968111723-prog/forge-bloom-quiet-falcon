# 淡江世界 · 五虎崗異象

此版本整合原巡禮、另一個 Grok 工作提供的系統，以及進階 RPG 玩法。主入口與 Sites 網頁入口使用同一個 AdventureApp。

## 遊玩

- WASD 移動，滑鼠調整視角，Shift 奔跑，空白鍵閃避。
- J 普攻，Q 科系技能，1 咖啡，2 烏龍茶，E 互動。
- I 背包、K 科系技能、B 建造、M 校園地圖、L 學期委託，Esc 選單。
- 建造時 E 放置、R 旋轉、Esc 結束；建築頁可拆除並回收材料。
- 地圖可前往各建築，入口按 E 進入，室內可切換樓層。戶外場地維持開放探索。
- 手機提供移動搖桿、視角拖曳、奔跑、互動與戰鬥按鈕。

## 已實作

背包採用 Overworld Inventory，支援堆疊、容量、消耗品、裝備與地面溢出物品。九個學院提供不同的主動技能；技能有專注消耗、冷卻與五階升級。考試、報告與期末 Boss 具有追逐、攻擊預警、傷害、掉落、經驗與重生；Yuka 負責移動，局部 A* 提供避障路徑。每五分鐘最後一分鐘出現截止日或停電異象。

基地有自習工作臺、宮燈、路障與投射器，支援放置預覽、旋轉、重疊／坡度檢查、成本扣除、耐久與拆除；設施能恢復、照明、減速、防禦或自動攻擊。

地圖涵蓋官方校園圖 1–40 號設施與田徑場，共 41 個節點，保留原本十處巡禮蓋章。新建物位置、樓層與室內使用遊戲化估算配置，並非實測校園或各教室的複製品。地圖名單依官方 2021 圖建立，科系名單另依 2026-11-07 官方學術單位頁核對。

## 本機與部署

Node.js 22 或更新版本：

```powershell
npm ci
npm run dev:site
npm run typecheck
npm test
npm run build:site
npm run preview:site
```

靜態版使用 8088 埠，建置輸出 dist，Sites 身份保存在 .openai/hosting.json。Sites 發布保持私人，只發布靜態遊戲，不發布 Node 登入或資料庫服務。瀏覽器自動存檔並可在設定中匯入／匯出；跨瀏覽器不會自動同步。原 Node／TanStack／資料庫程式保留在來源中，登入路由仍保留，但靜態部署不包含伺服器功能。

原巡禮存檔保留，既有背包／科系資料會在第一次開啟 RPG 時遷移；RPG 使用獨立 tamkang-rpg-v2 儲存鍵。地面掉落、建造、任務、技能、生命、學分與角色位置都有保存。手動匯出也包含巡禮進度。

## 效能與驗證

手機採省電預設，降低植被、像素比、陰影與燈光數；較慢裝置會自動降低像素比。遠處敵人停止更新與顯示，AI 固定步進、HUD 分別訂閱狀態；後製、招牌、建物幾何與材質有清理路徑。後製修正 ACES 映射、Sprite 材質不套用表面法線著色器，並統計整段後製的繪製次數。

npm test 在 Windows 明確列出測試檔，避免舊 glob 指令執行零個測試。新的 runtime tests 使用真正的 Overworld、Yuka 與已編譯遊戲模組，驗證消耗、冷卻、傷害、掉落、建造、任務、入口、連通、存檔及錯誤資料。

第三方授權文字見 public/third-party-notices.txt；模型授權見 public/models/vendor/ATTRIBUTION.md。

## 來源

- 官方學術單位：https://classic.tku.edu.tw/acad.asp
- 官方校園圖：https://classic.tku.edu.tw/doc/CampusMap202103.pdf
- Overworld：https://github.com/luzhenqian/overworld
- Yuka：https://github.com/Mugen87/yuka
- Three.js／R3F／Drei／Zustand：各套件隨附授權。
