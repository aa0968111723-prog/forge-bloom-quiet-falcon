# 學期模組接線

此模組尚未接上 `tickRpg`。`tickRpg` 仍用可變 delta。戰鬥預覽走 `stepEncounter`，內部只呼叫 `createSimClock().step`。不要在 HUD 或 `store.ts` 再寫一套步進。

## 物理匯出

- `createSimClock`、`FIXED_DT`、`MAX_CATCHUP_STEPS`（以 `CATCHUP_STEPS` 轉出）：暫停時 `clock.pause()` 清累加器，回傳 0 步，不補傷害。
- `sweepCircle`：視線與推開。`LOS_FUNCTION` 就是這個名字。路障放在 `extra`。掃掠在目標前停下則 `resolveHitSignals({ blocked: true })`，傷害 0。
- `resolveHitSignals`、`createHitLedger`：命中才扣血。閃避是 `kind: "dodge-iframe"`、`amount: 0`。
- 追擊用既有 Yuka `Vehicle` + `SeekBehavior`，路點用 `findWalkablePath`。遠距門檻 60，與 `tickRpg` 相同，每 4 個固定步才更新一次，且不結算傷害。

## 獎勵

`src/game/rpg/growth/index.ts` 尚不存在。`grantQuestReward(eventId, host)` 在同一個存檔 host 上每個 id 只加一次經驗。日後改為呼叫 C 的 `grantXp`，不要在這裡再加第二套經驗公式。

## 存檔

沿用 version 2、鍵名 `tamkang-rpg-v2`。`readV2Story` 保留已領支線、任務 id 與 `boss > 0`。缺欄位不是勝利。不要升版。

## 外觀

只有三個 id，`license: "existing-rig"`、`status: "pending-asset"`。沒有新模型。低畫質與重載用同一個 id。

## 明日可接、今天不要改的檔

`tickRpg` 的敵人迴圈、`attack` / `dodge`、異象 300 秒循環、`claim`、背包 `intakePreview`。動作時間對齊現有數值：普攻 0.46 秒、閃避無敵 0.45 秒、受傷 0.4 秒、補血 45（`itemdetail.COFFEE_HEAL`）。
