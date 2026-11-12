# 給統整線的 id 與狀態需求

本線沒有新增科系 id，也沒有新增學期時鐘。下面是已經用現成資料接上的部分，以及還在等的介面。

## 已用的現成 id

十二名虛構角色的 `departmentId` 都在 `src/game/departments.ts`：architecture、chemistry、mass-comm、ba、japanese、diplomacy、ed-tech、ai、med-info。系主任與該系教授共用同一個科系 id。

站點是敘事地點 `post-*`，不是新的 `CAMPUS_SITES` id。座標由既有 `siteEntrance` 外推 12 公尺，`accuracy` 為 estimated。來源沿用校園地圖 PDF（2026-11-12 註記：本輪沒有重新下載，也沒有實測）。

## 學期

遊戲裡的學期仍是 week-1。本線的事件沒有 `semester` 條件。期中、期末沒有被這條線觸發，也不能說已經正式觸發。

若以後某段要等期中或期末，請統整線給一個 canonical 學期訊號。在那之前，本線不會自造時鐘，也不會把 week-1 的劇情標成期中或期末。

## 存檔上限

`readNarrativeSession` 原本把 fired、resolved 和旗標圖截到 40。十二人四段加上跨線旗標會超過這個數，後果會在讀檔時被裁掉。本線把上限改成 `NARRATIVE_SAVE_LIMIT = 200`。recent 仍是 3。獎勵仍走 `grantQuestReward` 和既有 claimed，沒有第二套帳本。

`MAIN_INTEGRATION` 維持 false。事件可以從主遊戲的交談提示玩到，但沒有把全目錄的 integrated 開關打開。
