# 交接

最後更新：2026-11-11。從 `CHECKPOINT.json` 的 `next_action` 繼續。

## 現在

- `origin/main` 是 `df63d01261ad7d7a0e301b8bf91b1d6c473cbae3`。PR #10 已合併。遊戲合併提交是 `be6fdd6`，其後這份記錄只改文件。
- 來源美術 head 仍是 `8d5ffd08dad9f1727a2028bdf683f7355844d9c7`。
- 後端草稿 PR #9，分支 `feature/backend-game-services`，head `a38ef8e41cfddc9520e60b62a992bae16a4648d5`，基底 `71f4d3c`。下一項用新 worktree。
- 內容沒有新提交。不要改其他代理的工作區。

## 本輪已驗證（M2，尚未進 main）

在 `/tmp/worktrees/art-m2` 的 `be6fdd6`：`npm run typecheck` 通過，`npm test` 225 通過，衝突檔 eslint 0，`npm run build:site` 通過。靜態預覽 `http://127.0.0.1:8090/` 的省電五段路線：`quiz-2` 65→25，室內宮燈教室可見主角，返回戶外，`pageErrors` 空。另拍到分組報告聚合體 145/145、期中考監視者 240/240、期末・截止日 520/520。主機是 SwiftShader。

## 下一步

靜態產物預覽 `http://127.0.0.1:8093/` 已走完整條路線，結果與開發站相同：經驗 20、筆記 19、突襲小考 65→45、第二客戶端、`revision_conflict`、登出 401。遊戲程式仍是 `27e180c`。

遠端沒有超前 `main` 的分支。下一次先 `git fetch` 看有沒有新 head。遊戲程式沒變就不要重跑路線，也不要為了把檢查點 SHA 對齊再寫一筆空記錄。

路線命令：

```sh
node --experimental-transform-types scripts/integration-route.mjs http://127.0.0.1:8086/ /tmp/integration-route
```

靜態站要先開著。這次結果：經驗 20、筆記 19、突襲小考 65→45、第二客戶端下載到化學學系、衝突是 `revision_conflict`、登出後 401。

遠端沒有超前 `main` 的分支。INT-01 與 INT-12 維持不動。不要新增學期選擇，也不要做第二套獎勵帳。

## 不要做

正式部署、開通付費、正式資料庫遷移、刪玩家資料、強推、繞過保護、自批自己的必要 review。M1 不是整款遊戲完成。
