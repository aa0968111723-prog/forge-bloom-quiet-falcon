# 後端基線（2026-11-11）

盤點時 `origin/main` 與本機 `HEAD` 都是 `71f4d3c4742fab66b0d82edff38c7e6c39497f67`（Implement jade campus fantasy art direction）。工作區乾淨，沒有 stash。開放中的 pull request 只有 [#6](https://github.com/aa0968111723-prog/forge-bloom-quiet-falcon/pull/6)（美術管線，`cursor/tamkang-art-pipeline-1a71`）。這次沒有改那條分支。

## 兩條執行路徑

- 靜態遊戲：`index.html` → `src/adventure-main.tsx` → `AdventureApp`。`npm run build:site` 用 `vite.static.config.ts`，輸出 `dist`，不啟動資料庫。
- Node 應用：TanStack Start + Nitro `node-server`。`npm run dev` 聽 `0.0.0.0:8080`。`npm start` 先跑 `scripts/migrate.mjs`，再跑 `.output/server/index.mjs`。

`src/game/rpg/AdventureApp.tsx` 沒有登入閘門。驗收測試要求這份原始碼不含登入字樣。

## 存檔

- RPG 瀏覽器鍵：`tamkang-rpg-v2`（`src/game/rpg/store.ts` 的 `RPG_SAVE_KEY`）。快照 `version: 2`，含 `hp`、`slots`、`buildings`、任務 `claimed`、巡禮段落等。
- 舊巡禮本機鍵：`tamkang-world-v1`（`src/game/save.ts`）。第一次進 RPG 時由 store 遷移，不是雲端 RPG 列。
- 舊雲端巡禮：`migrations/0002_pilgrimage.sql` 的 `pilgrimage` 表，經 `src/lib/pilgrimage.ts` 的 server function 讀寫。欄位只有 `visited` 與 `play_seconds`。它不能覆蓋 RPG 存檔。

## 已有的登入與資料庫

- Better Auth 在 `src/lib/auth/server.ts`，路由 `/api/auth/*`。Cookie 是 `__Host-`、`Secure`、`SameSite=Lax`。不要改這份預接設定。
- 信箱密碼原本關閉。現在只在 `AUTH_EMAIL_PASSWORD=true` 時開啟（`src/lib/auth/email-password.ts`）。
- `src/lib/db.ts`：有 `DATABASE_URL` 用 `pg`，否則用 PGLite。`migrations/*.sql` 是 schema 來源。`userId` 只從 session 來，不從 body 來。
- 沒有 RPG 雲端存檔表，也沒有 revision。

## 這次不碰

人物、怪物、技能美術、校園幾何、主 RPG store 的戰鬥與背包邏輯、`package.json` 與 lockfile。
