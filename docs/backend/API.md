# RPG 雲端存檔 API

實作：`src/server/cloud/http.ts`、`src/server/cloud/service.ts`。Node 程序是 `scripts/game-services-server.mjs`。TanStack 路由掛在 `/api/health`、`/api/ready`、`/api/cloud/$`。

身分只看 Better Auth session（cookie 或既有 bearer）。請求裡的 `userId`（body 或 query）一律 `403 forged_user`，即使它等於 session 也不採用。

變更請求要帶 `x-cloud-save: 1`。有 `Sec-Fetch-Site` 時只允許 `same-origin` 或 `none`。`Origin` 若存在，必須在允許清單內；回應會回顯該來源並加 `Access-Control-Allow-Credentials: true`。允許清單是 `BETTER_AUTH_URL`、`CLOUD_SAVE_ORIGINS`，以及本機 `8080` / `8088`。不會回 `*`。

Cookie 沿用 Better Auth 的 `__Host-`、`Secure`、`SameSite=Lax`。正式環境用 HTTPS 與 `BETTER_AUTH_URL`。

## 版本

| 欄位             | 值         | 意義                        |
| ---------------- | ---------- | --------------------------- |
| `schemaVersion`  | `1`        | 這份雲端信封                |
| `contentVersion` | `2`        | RPG 存檔 `document.version` |
| `revision`       | 伺服器整數 | 樂觀鎖。不看裝置時間        |

內容效果只允許 `heal`、`focus`、`damage`、`capacity`、`build_range`、`grant_item`，而且只能有 `type`、`amount`、`itemId`。存檔裡的程式文字會被拒。沒有排行榜端點。客戶端送來的經驗、貨幣、分數只是存檔內容，不是可競技成績。文件頂層若出現 `score` 或其他白名單以外的欄位，整份寫入是 `422 unsafe_content`。

`document` 頂層只接受目前 `snapshot()` 會寫的欄位，加上既有的 `effects`。缺欄位的舊存檔仍可上傳。地面掉落除了 `id`、`x`、`z`、`items`，可以多帶 `quest`，記下這堆裡有多少來自委託；每個數量必須是整數，而且不能超過該物品在這堆裡的數量。沒有 `quest` 的舊掉落仍可上傳。其他掉落欄位是 `422 unsafe_content`。`harvested` 裡，野外補給點與 `facility:` 加建築 id 的冷卻，若仍落在未來 180 秒內，匯入與雲端重載會留下；已過期或超出這個窗口的時間會丟掉。鍵仍要符合既有 id 格式。若帶了 `narrative` 或 `variety`，形狀必須對得上遊戲讀回時保留的工作階段：敘事地圖最多 200 筆、字串短於 80、學院 id 用現有清單；多樣玩法的 `active` 要有階段、路線與能力快照，盤面的 `board` 只能是 `investigate`、`puzzle`、`escort`、`route`、`repair`、`combat`。整份文件的欄位數上限是 `MAX_DOCUMENT_KEYS`（8000），好讓 48 座設施、背包、敘事與一個玩法盤面同時通過，同時擋住無上限的地圖。

## 端點

### `GET /api/health`

不碰資料庫。`200 {"ok":true,"service":"cloud-save"}`。

### `GET /api/ready`

`select 1`。資料庫不可用時 `503`：

```json
{ "ok": false, "error": { "code": "database_unavailable", "message": "資料庫無法使用。" } }
```

### `GET /api/cloud/content/manifest`

不需登入。回傳與 `BUNDLED_CONTENT_MANIFEST` 相同的版本與效果白名單，`source` 為 `server`。客戶端失敗時用打包清單。進行中的事件或內容版本不同時，客戶端保持目前內容（`decideContentUpdate`）。

### `GET /api/cloud/saves/rpg`

登入後讀自己的存檔。沒有列時：

```json
{ "error": { "code": "not_found", "message": "尚未有雲端存檔。" }, "idempotentReplay": false }
```

成功時 `200`，`ETag` 為 `"<revision>"`，`Cache-Control: no-store`：

```json
{
  "revision": 1,
  "schemaVersion": 1,
  "contentVersion": 2,
  "document": { "version": 2, "hp": 80, "xp": 5, "slots": [], "buildings": [] },
  "etag": "\"1\"",
  "contentHash": "<sha256>",
  "idempotentReplay": false
}
```

### `PUT /api/cloud/saves/rpg`

```json
{
  "schemaVersion": 1,
  "contentVersion": 2,
  "baseRevision": 0,
  "confirmFirstSync": true,
  "requestId": "localreq1abcd",
  "document": {
    "version": 2,
    "hp": 80,
    "xp": 5,
    "slots": [{ "itemId": "coffee", "quantity": 1 }],
    "buildings": []
  }
}
```

- 尚未有雲端列，且 `confirmFirstSync` 不是 `true` 或 `baseRevision` 不是 `0`：`409 first_sync_required`。不寫入，也不清本機。
- `baseRevision` 不等於目前 revision：`409 revision_conflict`，body 含 `server`（revision、document、etag、contentHash）與 `clientRevision`。
- 成功：`200`，revision 加一，舊版本留在 `rpg_save_revisions`（最多 8 筆）。
- `If-Match` 若存在，必須等於 `baseRevision`，否則 `400 if_match_mismatch`。
- 舊巡禮或世界存檔（只有 `visited`、`playSeconds`，或 `version: 2` 但沒有 RPG 的 `hp` 與 `slots`）：`422 legacy_pilgrimage`。不寫 `pilgrimage` 表，也不寫 RPG 表。
- 遊戲仍可匯入的舊版 RPG（`version: 1` 且含 `inventory`、`hp`、`xp`、`slots`、`skillRank` 或 `claimed`）：`422 legacy_rpg`。不寫入雲端，也不改本機。玩家先在遊戲裡匯入，遊戲會存成現在的 `version: 2`，之後才能上傳。
- 其他不相容內容：`422 incompatible_content`。
- 壞 JSON：`400 invalid_json`。超過 256 KiB：`413 payload_too_large`。
- 未登入：`401 unauthorized`。缺 `x-cloud-save`：`403 csrf`。

同一 `requestId` 與相同內容重送：回原來的狀態碼與 body，`idempotentReplay: true`，revision 不再增加。相同 `requestId` 但內容不同：`409 idempotency_mismatch`。

玩家保留雲端：客戶端把 `server.document` 寫回本機，不再 PUT。玩家保留本機：用衝突回應裡的 `server.revision` 當新的 `baseRevision` 再 PUT。這是明示選擇，不是用時間戳覆蓋。

### `GET /api/cloud/saves/rpg/revisions`

只回目前 session 的版本編號、`contentHash` 與 `createdAt`，不含存檔本體，也不含其他帳號。沒有雲端列時 `headRevision` 是 `null`、`revisions` 是空陣列。查詢帶 `userId` 回 `403 forged_user`。未登入回 `401`。歷史最多 8 筆，較舊的會被刪掉。

### `POST /api/cloud/saves/rpg/restore`

```json
{ "baseRevision": 4, "revision": 1, "requestId": "restore-first-01" }
```

把歷史 revision 複製成新的 head。`baseRevision` 必須是目前 head。找不到歷史版本是 `404 revision_not_found`。同樣使用 `requestId` 冪等。

### `POST /api/cloud/saves/rpg/receipts`

```json
{ "eventId": "quest_side", "requestId": "reward-side-0001" }
```

```json
{ "applied": true, "eventId": "quest_side", "idempotentReplay": false }
```

`applied: false` 表示這個帳號已經記過該事件。重送同一個 `requestId` 會帶回第一次的 body，並把 `idempotentReplay` 設為 `true`。伺服器不發放經驗或貨幣。客戶端必須在本機把事件 id 記下來，重試時不再呼叫發獎函式。

寫入預設每帳號每 60 秒 30 次（`CLOUD_SAVE_RATE_LIMIT`、`CLOUD_SAVE_RATE_WINDOW_MS`）。超過回 `429 rate_limited` 與 `Retry-After`。這是單一程序內的計數。

## 客戶端上傳

面板的「上傳本機」呼叫 `uploadLocal`。沒有雲端列時才送 `confirmFirstSync: true` 與 `baseRevision: 0`。已有 revision 時用本機記下的 revision 續寫，`confirmFirstSync` 為 false。雲端 revision 已經前進時不送寫入，回到衝突選擇。網路失敗的寫入留在該帳號佇列。面板重新載入且本機仍記著該帳號時會再送一次；登入時也只送出目前帳號的佇列。相同 `requestId` 重送不會增加 revision。

## 客戶端

`src/features/cloud-save/client.ts` 的 `createCloudSaveController`：

- `writeLocal` 只寫 `tamkang-rpg-v2`，不發請求。
- 未登入時 `plan()` 是 `local_only`。
- 雲端 404 是 `need_first_sync`。`uploadFirstSync` 才會帶 `confirmFirstSync: true`。`keepLocalOnly` 不上傳。
- 沒有本機存檔時是 `need_download`，要呼叫 `downloadCloud` 才寫入。雲端空資料不會清本機。下載和恢復會先檢查存檔白名單，並核對內容雜湊；對不上就不覆蓋本機。寫入本機後會告訴進行中的遊戲，自動存檔不會把剛下載的進度蓋掉，玩家再選擇保留現有進度或改用這份。改用這份時，室內樓層會跟著存檔留下。
- 本機與雲端不同，且本機記錄的 revision 不等於伺服器：`conflict`。`keepRemoteVersion` / `keepLocalVersion` 才解決。
- 網路失敗的 PUT 進 `tamkang-cloud-save-queue:<userId>`。同一個帳號只留最後一次上傳。`flush` 只送目前帳號的佇列。內容沒變時重試沿用原來的 `requestId`；若失敗後本機又有新進度，改用新的 `requestId` 送本機這份。若這次和雲端衝突，而且雲端內容仍是這台裝置剛才寫入的那份，就從那個版本再寫上新進度。雲端若已是別的內容，則留下衝突，不覆蓋。若這次續寫時玩家已經拿掉上傳，會把玩家留下的本機存檔再寫回去。送出途中被拿掉的上傳若在回應前斷線，不會重新排進佇列；事後讀到的雲端若就是剛才送出的那份，會把留下的本機存檔再寫回去。確認 session 的連線中斷時仍會寫回；session 已換成另一個帳號則不寫。退避 1s、2s、4s，上限 30s。成功下載或恢復雲端存檔後，會拿掉這個帳號尚未送出的存檔上傳，獎勵回執留著。送出佇列時只移掉這次處理完的項目，途中新排入的回執或被拿掉的上傳都不會被整份佇列蓋掉。若拿掉的上傳仍寫進了伺服器，而佇列裡沒有下一筆上傳，會把玩家留下的本機存檔再寫回去。第一次送出時若本機存檔比佇列裡的快照新，改送本機這份。
- `logout` 只清目前帳號標記，不刪 RPG 存檔，也不把上一個帳號的佇列送給下一個帳號。
- 上傳、下載、恢復、列出版本和送出佇列之前，會先讀 `/api/auth/get-session`。session 的使用者必須等於這台裝置記的帳號。不同就回 `account_mismatch`，不讀、不寫另一個帳號的存檔，佇列留在原帳號。連不上 session 時不送出。佇列每一筆送出前會再讀一次；前一筆完成後若 cookie 換成另一個帳號，後面的上傳停住，留在原帳號。讀到雲端存檔後、寫進本機前也會再讀一次，session 已經換人就不採用那份存檔。
- `noteReward` 先把事件記在這台裝置。同一個事件再呼叫、登出後再呼叫，或換帳號登入，都不會再執行發獎函式。登入時只把這台裝置尚未記到該帳號的回執排進該帳號佇列。已登入且伺服器回 `applied: false` 時不發獎。第一次 session 讀取成功後，若確認 session 的那次連線中斷，仍會先問伺服器；伺服器說這個事件已經記過就不發獎。伺服器連不上時才在本機發一次並把回執留在佇列。
- `restorePrevious` 在玩家按下時，把目前 head 的前一個 revision 複製成新 head，並寫回本機。只有一份雲端版本時不改本機。離線時不把恢復排進佇列。
- `listRevisions` 只讀目前帳號的版本編號。`restoreRevision` 把玩家選中的那一筆複製成新 head 並寫回本機。找不到、衝突，或選到目前 head 時，不改本機。恢復不寫獎勵回執。

Node 首頁 `src/routes/index.tsx` 掛了 `CloudSaveDock`。靜態入口沒有引用它。
