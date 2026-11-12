# 裝備槽遷移

正式的共用 schema、store 白名單、雲端欄位與匯入匯出仍由統整線落地。這一線只在現有存檔版本 2 上加可選欄位，不升 `CLOUD_CONTENT_VERSION`。

## 舊語意

`equipped: true` 仍表示五虎崗徽章的生命 +25 與普攻 +5。`lifeCap` 與 `basicAttackDamage` 繼續讀這個布林值。徽章留在背包裡。沒有徽章時呼叫舊的 `equip()`，不會把一個已經是 true、但背包沒有徽章的旗標改掉；這是既有測試的契約。

## 沒有 loadout 的舊檔

| 舊檔 | 讀入後 |
| --- | --- |
| `equipped: true` 且背包有徽章 | 配件槽是 `badge`，`equipped` 仍是 true |
| `equipped: true` 但沒有徽章 | 三槽都空，`equipped` 改為 false |
| `equipped` 缺省或 false | 三槽都空，`equipped` 是 false |

## 已有 loadout 的檔

`loadout` 是 `{ tool, accessory, pack }`。每一格只接受背包裡擁有、而且類別對得上的物品 ID。對不上的格子變空，不刪背包。`equipped` 改寫成「配件格是 badge」。因此徽章加成不會因為別的配件再算一次。

## 實例

裝備實例 ID 是 `gear-<itemId>`，同一物品只留一筆。耐久與精工寫在這筆上。重複的實例 ID 或物品 ID 會跳過。未知物品的實例放進 `quarantineGear`，不加能力。

## 未知物品

未知的背包 ID 不進 24 格，改放 `quarantine`，重新匯出時還在。負數量拒絕整份匯入。咖啡超過堆疊上限時夾到 20。整份存檔不會因為一個未知 ID 被清空。

雲端衝突只把 `saveConflict` 設為 true，不改目前的槽位。

## 移動中的建物

快照多了可選的 `heldBuild`。讀回時如果那座建物的 ID 不在 `buildings` 裡，就放回原座標並結束移動。取消、倒下與換點也會先放回。這個欄位不是第二份建物清單。

## 統整線尚未做的事

雲端白名單還沒有正式列入 `loadout`、`gear`、`quarantine`、`quarantineGear`、`heldBuild`。現有 `walkValue` 會放行這些額外鍵，所以本地與目前的匯入可以帶著它們。統整線若收緊白名單，要一併收下這五個鍵，否則舊檔的槽位會在雲端回合被丟掉。不要為了這件事單獨升內容版本，除非統整線決定要拒絕未知鍵。
