# 交接

分支：`feature/backend-game-services`。工作區在獨立 worktree，不跟 `main` 或其他代理共用正在改的 checkout。基底是 `71f4d3c`。開放中的美術 PR #6 沒有被修改。

## 怎麼跑

靜態遊戲維持：

```bash
npm run dev:site
npm run build:site
```

選配的 Node 存檔服務：

```bash
AUTH_EMAIL_PASSWORD=true \
BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
PGLITE_DATA_DIR=./data/pglite \
node --experimental-transform-types scripts/game-services-server.mjs
```

`npm run dev` 會一併掛上 `/api/cloud/*` 與首頁的雲端面板，但信箱密碼要有 `AUTH_EMAIL_PASSWORD=true`。沒有這個變數時，遊戲仍可本機遊玩。正式環境必須自己提供 `BETTER_AUTH_SECRET` 與 `DATABASE_URL`。

直接跑整合流程：

```bash
node --experimental-transform-types scripts/cloud-save-flow.mjs
```

`npm test` 會用同一個旗標啟動它。

## 檔案

- 契約與狀態：`docs/backend/`
- 共享驗證：`src/features/cloud-save/contract.ts`
- 瀏覽器適配器與面板：`src/features/cloud-save/client.ts`、`CloudSaveDock.tsx`
- HTTP 與 SQL：`src/server/cloud/`
- 遷移：`migrations/0003_rpg_saves.sql`（只新增表）
- Node 首頁才載入面板：`src/routes/index.tsx`
- 靜態入口 `src/adventure-main.tsx` 與 `AdventureApp.tsx` 沒有改

`package.json` 與 lockfile 沒有改。主 RPG store 沒有改。資料層的必要改動在 `src/lib/db.ts`（交易、檔案型 PGLite、`closeDb`、Node 讀得到 migration）與 `scripts/migrate.mjs`（可被 import，不在 import 時結束程序）。信箱密碼開關改為讀 `AUTH_EMAIL_PASSWORD`。

## 整合

- 內容 schema 仍由內容代理維護。伺服器只檢查型別與效果白名單。
- 資產 manifest 沿用美術代理。遊戲 id 不要在這裡重造。
- 舊的 `pilgrimage` server function 還在，給巡禮蓋章用。不要拿它寫 RPG 存檔。

## 目前的存檔形狀

`src/features/cloud-save/contract.ts` 的頂層白名單對齊 `snapshot()`。收集進度只收筆記、零件、咖啡、茶；擊退紀錄只收小考、報告、期中、期末。敘事與多樣玩法有各自的欄位上限。盤面只檢查 `board` 類型與欄位數，不執行盤面內容。舊存檔可以省略新欄位。

`scripts/cloud-campus-roundtrip.mjs` 把含 `interiorId` 與 `floor` 的校園存檔走一次真實上傳、第二客戶端下載與程序重開。室內續玩讀的就是這兩個欄位。

## 不要做

不要合併 `main`，不要部署公開站，不要對正式資料庫跑這份遷移，除非已經在備份上試過 `scripts/migrate.mjs`。沒有破壞性 SQL。
