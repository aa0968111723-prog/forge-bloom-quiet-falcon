# 驗收

實作提交 `7ffdd018e4cb131355daefbfd311a8c9da0e10a8`。文件提交在它上面，沒有改行為。

## 這次親自跑的

| 檢查 | 結果 |
| --- | --- |
| `npx tsc --noEmit` | 通過 |
| `npm test` | 274 通過、0 失敗。含 `scripts/items-gear.test.mjs` 的八個測試 |

沒有 CI 紀錄。這次通過不是 CI 通過。

`scripts/items-gear.test.mjs` 涵蓋：清冊數量與圖示不重複、加成只算一次且徽章攻擊不進 `gearBonus`、舊 `equipped` 對應、未知裝備隔離、付款失敗回滾、一半退款、零與負數量、道路／校門／任務點／救援點、48 座時的結構零件數在拆掉一座後下降、製作距離不夠不扣材料、重複製作失敗、裝上卸下再裝上、拆除後退款、匯入後燈光仍在、滿血滿專注與沒有燈時不消耗、滿包領獎不加零件、負數量拒絕整份、未知 ID 隔離且筆記還在、沒有徽章的 `equipped: true` 變 false、任務物品不能丟、研究桌不在旁邊不能做、另一個分頁寫入 `tamkang-rpg-v2` 只標衝突不改主工具、移動中的建物寫進存檔後匯入會放回原處。

建物零件數是 `MESH_PARTS` 的結構計數。48 座混合種類的總和大於 48，拆掉最後一座會減掉該種類的零件數。沒有量 GPU 幀率，也不拿雲端 FPS 代替。玩家燈是一盞穩定的點光源，不依建物數量新增。

## 主遊戲畫面

裝置：這台 Linux VM 的 headed Chrome。不是手機，也不是 RTX 3060。

Renderer：`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`。

解析度：viewport 390×844、`deviceScaleFactor` 2、canvas 448×970、`window.inner` 390×844。指標被這次腳本改成 coarse，用來走手機版面。

步驟，都在 `http://127.0.0.1:8080/` 的學期冒險裡，不是獨立展示頁：

1. 開始學期，選第一個學系（文學院）。
2. 打開背包，點課堂筆記。卡片有來源、堆疊上限 99、重量 0.1。
3. 出生點選擇研究桌。預覽被拒，文字是「請保留克難坡通行空間」。可旋轉，可結束建造。
4. 用遊戲既有的 `__controlsTest.setPose(45, -27, 0)` 走到測試過的合法空地。研究桌預覽顯示「合法」。按下放置。提示「已建造研究桌」。同一瞄準再放會寫「與既有設施重疊」。
5. 這段短行程沒有打完第一堂課，所以用活著的 `inventory.add` 放入銅線圈 ×2 與燈具配方 ×1。配方的正式來源仍是第一堂課獎勵。接著按背包裡的「製作」。提示「製作完成」，同一列改為「已經帶著這件裝備」。
6. 裝備野外燈。提示「已裝備野外燈」。
7. 拆除。提示「設施已拆除，回收一半材料。已入袋：課堂筆記 ×2、構築零件 ×1」。已建設施回到 0/48。研究桌成本是筆記 4、零件 3，一半無條件捨去後就是 2 與 1。

畫面在 `/opt/cursor/artifacts/`：`items-bag-mobile.png`、`items-detail-mobile.png`、`items-build-mobile.png`、`items-place-mobile.png`、`items-ghost-legal-mobile.png`、`items-built-mobile.png`、`items-craft-mobile.png`、`items-equipped-mobile.png`、`items-refund-mobile.png`。同一輪的錄影是 `items-craft-place-demolish.mp4`。影片審閱子代理這次沒有啟動，所以上面的文字以腳本日誌與這些靜態畫面為準。

## 沒有親自跑的

手機真機、RTX 3060、雲端 CI、實地測繪。這些維持未測。
