# 淡江世界 · 五虎崗異象：來源同步紀錄

同步日期：2026-11-11（台灣時間）。

## 本次來源

- 網站：https://tamkang-world-adventure.aa0968111723.chatgpt.site
- Sites project：appgprj_6aedf1b344a48191a6a422ee6f99d056
- Sites 已發布版本：3。
- Sites source commit：832fac5c7341271c9194460af0b02459a75e3c64。
- GitHub 同步前 main：71038543a3f0dfe14e054627e61160960fe453de。
- 同步前備份分支：backup/pre-sites-rpg-sync-20261111。

本次同步網站來源的全部 340 個受版本控制檔案，逐檔核對 Git blob 與檔案模式。
RPG、戰鬥、科系技能、建造、教學、存檔、室內外場景與測試均包含在內。

保留 GitHub 原有的 .dockerignore、.prettierrc、eslint.config.mjs 與 startup.sh，
以及既有提交歷史和其他分支。這四個既有設定檔與本紀錄是網站來源以外的檔案。
未加入 node_modules、建置產物、本機資料庫、環境密鑰或執行憑證。

## 執行靜態 RPG

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run dev:site
```

開發入口為 http://localhost:8088 。驗證與建置：

```sh
npm run typecheck
npm test
npm run build:site
npm run preview:site
```

靜態部署使用 dist/ 與 .openai/hosting.json；Node／Zeabur 的 Dockerfile
與 npm run build 是另外的部署流程，涉及既有伺服器與資料庫設定。
本次只同步來源，沒有變更網站的公開受眾，也沒有重新部署 Node 服務。

## 本次檢查

- TypeScript 型別檢查通過。
- 203 項測試通過，0 項失敗。
- build:site 通過；產物與 Sites 基準使用相同的雜湊資產名稱。
- 建置仍有大於 500 kB 的 chunk 提示，保留為後續效能工作。
- 驗證重用網站 checkout 內與相同 lockfile 對應的已安裝依賴。
- 本次未執行乾淨環境 npm ci、手機真機測試或完整玩家通關測試。

來源中的 semester、growth、build-session 與 runtime 等部分模組仍有未接線項目。
同步不代表這些模組已完成玩家流程；現有 acceptance matrix 與測試中的待測狀態維持。

## 後續開發

日常開發以此 GitHub 的 main 作為主要來源；每次發布時同步同一份通過驗證的程式到 Sites，
記錄 GitHub commit、Sites source commit 與部署版本。
兩個 Git 來源的 commit SHA 可以不同，但應逐檔比對遊戲來源、設定與素材。

本次是一次性同步，尚未設定自動雙向鏡像。若網站另有新修改，先比對再同步，
避免任一端覆蓋尚未合併的變更。回退時使用備份分支或正常 revert，保留歷史。
