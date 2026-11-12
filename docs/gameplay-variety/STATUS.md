# 玩法變化線

這條線做主遊戲裡的多樣遭遇，不另開展示頁。入口是 `AdventureApp` 的場景標記與 HUD 按鈕。面板沿用既有 `setPanel`，打開時暫停、關掉後回到原本的 `playing`。

結算仍走 `grantQuestReward`。任務 id 是 `quest-gv-*`。劇情只在本線記憶寫 `variety.resolved`，不改教授對話旗標。裝備與建造只在開場讀進 `caps`。

校園座標沿用現有估計布局，不是實測還原。沒有新增外部素材。

`AGENTS.md` 不存在。本目錄在這次提交前不存在。
