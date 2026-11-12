# 交接

分支 `cursor/items-equipment-building-15c5`。行為提交 `bd2e531c6bf9d4d92165d9eb26640a508db450f6`，基底是當時的 `main` `5e9dc40`。統整文件裡寫的遊戲 SHA `1463b50` 比這個 checkout 舊；以程式與這個提交為準，沒有為了對文件去 fetch。

## 怎麼接

```bash
npx tsc --noEmit
npm test
npm run dev
```

開發伺服器在這台機器上是 `http://127.0.0.1:8080/`。`?qa=1` 會把活著的 `inventory` 掛在 `window.__rpgQA`，建物上限的 draw call 就是這樣讀 `window.__perfTest.info` 的。不要重啟別人的程序。這一線沒有合併、沒有部署、沒有改正式資料。

擁有 `src/features/items-equipment-building/**`、`docs/items-equipment-building/**`、`scripts/items-gear.test.mjs`。接到主遊戲的檔案是 `src/game/rpg/store.ts`、`data.ts`、`rules.ts`、`prompts.ts`、`itemdetail.ts`、`pack.ts`、`campus.ts`、`AdventureHud.tsx`、`AdventureWorld.tsx`、`AdventurePlayer.tsx`、`adventure.css`，以及 `scripts/rpg-runtime.test.mjs` 裡研究桌的合法座標（`place(45, -32)`，因為道路中心線在 z = -24）。

## 不要重做

背包仍是 `src/game/rpg/store.ts` 的 `createInventory`。徽章布林值仍是生命與普攻的唯一來源。建物上限、拆除一半退款、版本 2 都還在。雲端內容版本沒有加。

## 讀檔

沒有 `loadout` 時，`equipped: true` 且背包有徽章才會放進配件槽。未知物品進 `quarantine`，未知裝備實例進 `quarantineGear`。負數量拒絕整份。`heldBuild` 若有，而且 ID 不在建物清單裡，匯入時放回原處並結束移動。崩潰若發生在快照寫入之前，那一次移動仍可能丟掉那一座；寫入之後不會。

`pockets` 只會是 0、4 或 8。引擎容量是 36，活的上限由 `slotCap` 決定。匯入先打開到 36 再收緊，避免擴充過的存檔被截斷。卸下田野背包不刪多出來的格子裡的物品。

## 下一個動作

統整線把 `loadout`、`gear`、`quarantine`、`quarantineGear`、`heldBuild`、`pockets` 放進正式白名單後，雲端回合才算這些欄位耐久。在那之前不要升內容版本，也不要從功能線合併。手機與獨立顯示卡的同一條路線還沒拍。校園位置仍是 estimated。

開始時沒有 `AGENTS.md`。沒有新的外部素材。
