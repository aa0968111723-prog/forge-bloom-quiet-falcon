# 交接

最後更新：2026-11-11。從 `CHECKPOINT.json` 的 `next_action` 繼續。

## 現在

- 整合工作區：`/tmp/worktrees/art-pr6`，分支 `cursor/integration-art-m1-3395`。
- 來源：PR #6，分支 `cursor/tamkang-art-pipeline-1a71`，head `017b755`，base `main` @ `71f4d3c`。
- 不要把提交推回美術線分支。美術代理若還在，那條分支是它的。
- 不要改「淡江世界遊戲內容」「後端存檔同步」正在用的工作區。本輪它們還沒有遠端分支。
- `art-m1` 驗收已過，但合併受阻。PR #7（head `b3db57b`）`mergeable_state` 為 clean，`PUT /pulls/7/merge` 回 403。沒有推 main。
- 通過條件後要合併的是 PR #7，不是單獨再合併 PR #6（否則會少掉 glance 與骨架修正）。

## 本輪已驗證

見 `VALIDATION.md`。217 測試、型別、靜態建置、省電五段路線。戰鬥用既有規則把 `quiz-2` 從 65 打到 25。靜態預覽不需要伺服器。

## 合併之後

1. `git fetch origin main`，把實際 SHA 寫進 `QUEUE.json` 的 `mergeSha`，狀態改 `merged`。
2. 對合併結果再跑一次型別與靜態建置。樹若與已驗版本相同，記下 tree SHA，不必重跑整段路線。
3. 再列一次遠端分支與開放 PR。有後端或內容的新 head 才開下一項；沒有就停在 `next_action`，不要空跑全量測試。

## 不要做

正式部署、開通付費、正式資料庫遷移、刪玩家資料、強推、繞過保護、自批自己的必要 review。
