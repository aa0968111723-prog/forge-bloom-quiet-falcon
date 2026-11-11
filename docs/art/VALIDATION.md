# 驗收紀錄

每輪只記錄本次實際執行的結果。主機與限制見 `BASELINE.md`；frame time 皆為本主機 SwiftShader 數值。

## 第 1 輪（M1 可玩樣板）— 2026-11-11

分支 `cursor/tamkang-art-pipeline-1a71`；提交 `cbec4f6`（管線＋主角）、`93ed99b`（考卷怪＋工程技能）、`bad40fa`（主角 LOD1）。

### 自動檢查

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm test` | 215 通過 / 0 失敗（基準 206；新增 9 項美術管線測試，含 LOD1） |
| `npm run art:validate -- --rebuild` | 0 錯誤、0 警告；重新匯出與已提交 GLB 位元組相同 |
| `npm run build:site` | 通過；`dist/game-art/` 含兩個 GLB；`AdventureApp` chunk 555 → 577 kB（既有 >500 kB 提示仍在） |
| `npx eslint art scripts/art src/game/art` | 0 錯誤 |

`scripts/art-pipeline.test.mjs` 涵蓋：
- 驗證器對已提交輸出 0 錯誤；重建一致。
- 壞檔偵測：不存在的節點、動畫驅動非 joint 節點、宣告卻不存在的動畫、非單位四元數，都會被抓到。
- 主角：每頂點權重和 = 1、joint 索引有效、三角形 ≤ 22,000。
- 動畫：只驅動角色骨頭、四元數單位長度、idle/walk/run 首尾相接、walk/run 同腳起步（交叉淡入不剪刀腳）。
- 臉部方向：臉部貼圖的頂點 >98% 在 +Z 前方。
- 背包：背包前緣在外套背面之後至少 5 mm（靜止姿勢，涵蓋背包整個高度）。
- 腳底滑動（以骨架 FK 量測支撐腳相對髖部速度 × runtime 步頻）：walk 4.60 vs 4.6 m/s（0.0 %），run 7.82 vs 7.8 m/s（0.2 %）。
  修正前同一量測為 41 % 與 77.5 %，已依量測值設定步幅（walk 2.96、run 5.8 m／週期）。

### 畫面驗收（真實遊戲畫面）

重現方式：`npm run dev:site` 後執行
`node scripts/art/capture-art.mjs http://127.0.0.1:8088/ <dir> <turnaround|poses|combat>`。
`combat` 使用 `?qa=1` 定步時鐘（每步 1/30 s），遊戲規則與 AI 照常執行。

| 項目 | 證據（`docs/art/evidence/m1/`） | 判讀 |
| --- | --- | --- |
| 主角前／三分之四／側／背（宮燈教室室內固定光） | `protagonist-front/three-quarter/side/back.jpg` | 輪廓、配色符合規格；鞋頭偏扁、四肢偏細 → needs_review |
| 臉、手、鞋、背包特寫 | `protagonist-face*.jpg`、`-hands`、`-shoes`、`-backpack` | 大眼、高光、眉、腮紅、分束瀏海、小束髮、外套領口、袖口、吊飾可辨識 |
| 動作關鍵影格 | `protagonist-poses.jpg`（idle、attack t=0.13、skill t=0.17、dodge t=0.13、hurt t=0.07、interact t=0.30） | 動作方向正確，肩肘膝無明顯撕裂；背包隨胸部 |
| 考卷怪追擊、預警 30 %／80 %、出手 | `combat-1-chase`、`-2-telegraph-early`、`-3-telegraph-late`、`-4-strike` | 紅筆圈半徑＝判定半徑 3.25 m，填色隨 windup 進度；出手後玩家生命 100 → 91（quiz 傷害 9） |
| 玩家受擊、普攻 | `combat-5-player-hurt`、`-6-basic-attack` | 普攻使 quiz 65 → 45 |
| 工程技能時序 t = 0.03／0.10／0.20／0.30／0.50／0.73 s | `combat-7-skill-*` | 藍圖格 → 桁架波前到 12 m → 命中鋼梁（hits = ["quiz-2"]）→ 消散；quiz 45 → 5 並被推開約 1.9 m |
| 擊倒 t = 0.07／0.27／0.60／1.07 s | `combat-8-defeat-*` | 揉皺、縮小、紙片紛飛後隱藏 |
| 原始紀錄 | `combat.json`、`poses.json`、`turnaround.json` | 每張的狀態值；無 page error |

### 實際遊玩（一般桌面 Chrome，人工操作）

由操作代理以鍵盤遊玩 `http://127.0.0.1:8088/?q=low`：選土木工程學系 → 地圖「前往宮燈教室」→ 沿宮燈大道步行 → 遇考卷怪 →
J 普攻、Space 閃避、Q 結構脈衝。錄影 80 秒（`m1-lantern-avenue-gameplay.mp4`，產物附件），截圖於 `docs/art/evidence/m1/realplay/`。
影片審閱確認：0:34 地圖傳送、0:46 起沿大道步行、0:50 與 1:15 兩次結構脈衝（藍圖格與桁架環清楚）、0:51 命中、0:52 考卷怪消失並掉落。
審閱指出 1:02–1:17 角色未播步行；逐格檢查為按住 W 撞上迴廊台基（見 KNOWN-ISSUES KI-17），定步探針確認正常移動時動畫正確。
第一次較長的嘗試中角色被擊倒並成功復活（復活流程正常）。

### 效能（同主機、同解析度、同路線）

`node scripts/art/capture-route.mjs http://127.0.0.1:8089/ <dir> --tier low|high`，對 `vite preview` 產物。
結果與判讀見 `STATUS.md`；手機與 RTX 3060 目標一律 `pending-device`。

### 未驗收

- 真機 FPS、溫度、觸控：pending-device。
- reduced-motion 與低畫質的技能／怪物畫面：程式路徑已實作（無擴張、無粒子、固定預警），本輪尚未留截圖。
- 背包在各動作中的數值穿模檢查：只做靜止姿勢與目視。

## 第 2 輪（NPC 與三種怪物）— 2026-11-11

提交 `e3537e0`、`6fec50b`、`7ec1984`。

### 自動檢查

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm test` | 219 通過 / 0 失敗 |
| `npm run art:validate -- --rebuild` | 0 錯誤、0 警告；七件 GLB 重建位元組相同 |

新增測試：NPC 部件共骨架、權重和為 1、著色槽 1–11 或 255；五組預設齊全且兩兩至少差 4 個部件、可合併、三角形 ≤ 10,000，並與 `Npcs.tsx` 的 `ROSTER` 一致。四種怪物都有六段動畫，attack／hurt 回到靜止，defeat 縮小到 ≤ 0.5；正面剪影在身高正規化後 IoU：quiz/report 0.49、quiz/exam 0.45、quiz/final 0.65、report/exam 0.25、report/final 0.46、exam/final 0.42（重上色自己對自己是 1.00，會失敗）。衝刺 90 幀頭部注視仍等於單次偏移。兩個網格共用的骨架只釋放一次骨骼貼圖。

### 畫面（`?qa=1` 定步，高畫質，真實規則）

| 對象 | 證據 | 紀錄 |
| --- | --- | --- |
| 五名 NPC | `evidence/m2/npcs-front.jpg`、`npcs-side.jpg` | 各在自己的路線上行走，無頁面錯誤 |
| 主角鞋與手 | `evidence/m2/protagonist-shoes-hands.jpg` | 圓頭鞋、分開的手指 |
| report-1 | `creature-report-turn.jpg`、`creature-report-fight.jpg` | 追擊；前搖 1.20 s 的 40%／85%；出手後玩家 84 血；普攻 145→125；擊倒 hp 0 |
| exam-1 | `creature-exam-turn.jpg`、`creature-exam-fight.jpg` | 前搖 1.40 s；出手後玩家 78 血；普攻 240→220；擊倒 |
| final-1 | `creature-final-turn.jpg`、`creature-final-fight.jpg`、`creature-final-open.jpg` | 前搖 1.60 s；出手後玩家 72 血；普攻 520→500；擊倒。出生點在樹蔭下；空地（宮燈大道 0, -130）的正面與背面輪廓清楚 |

exam 與 final 的四面照取自真實出生點，樹木擋住部分輪廓。戰鬥時序是這輪的驗收依據。

## 第 3 輪（八學院技能）— 2026-11-11

`npm test` 222 通過 / 0 失敗。宮燈大道上對 quiz-2 呼叫真正的 `attack(true)`，定步拍下出手後約 0.43 秒。每次施放前把 quiz-2 血量設回 200，否則後面的學院打到已倒下的目標、`hits` 為 0。

| 學院 | 範圍 | 命中 | 畫面 |
| --- | --- | --- | --- |
| science | 10 | 1 | 貼地的兩道反向環 |
| humanities | 14 | 1 | 沿路展開的絲帶 |
| business | 12 | 1 | 金幣飛向目標 |
| language | 16 | 1 | 三個符文繞行，紅色預警仍可見 |
| education | 13 | 1 | 半透明黑板圓，預警圈在上面 |
| international | 14 | 1 | 兩道弧在路中央會合 |
| computing | 14 | 1 | 環狀掃描格 |
| health | 12 | 1 | 淡綠半球，目標與血條仍可讀 |

總覽：`docs/art/evidence/m2/college-skills.jpg`。

## 第 4 輪（學院施放姿勢）— 2026-11-11

`npm test` 226 通過。九段施放在宮燈教室定步到 0.20 秒，姿勢互不相同：工程下砸用到腿，其餘八段只動上半身。工程沒有 `skill-engineering` 片段，所以仍播原本的 `skill`。畫面：`docs/art/evidence/m2/cast-poses.jpg`。

## 第 5 輪（普攻光刃）— 2026-11-11

普攻不再把圓環放大到 3.7 m。刃長約前臂，0.06 秒在角色右側，0.15 秒經過伸出的手，0.25 秒到左側。`scripts/art-runtime.test.mjs` 檢查這段位移；宮燈大道定步畫面是 `docs/art/evidence/m2/basic-swing.jpg`。蓄力幀從正面看會被身體擋住。

## 第 6 輪（清冊重產與三類公共室內）— 2026-11-11

`node --test scripts/campus-registry.test.mjs`：11 通過。重新產生的清冊與 `BASELINE.md` 第 6 節筆數、別名 id、saveKey、分區數一致，沒有增刪。每筆非別名都有入口記錄，狀態仍是 `pending-survey`。

三類既有公共室內（遊戲化，不是實測房間）定步進出：

| 房間 | 室內 | 出來之後 |
| --- | --- | --- |
| 宮燈教室 | interiorId palace，人在 (0, 4)，hp 100，主修保留 | interiorId null，人在 (-8, -76) |
| 圖書館閱讀桌 | interiorId library，人在 (0, 4) | interiorId null，人在 (10, -290) |
| 體育館球場 | interiorId gym，人在 (0, 4) | interiorId null，人在 (166, -104.5) |

畫面：`docs/art/evidence/m2/public-interiors.jpg`。

## 第 7 輪（光照與大道道具）— 2026-11-11

同一站點 `(0, -80)`、高畫質、定步。`timeOfDay` 依序為 day、sunset、night、wet，頁面沒有錯誤。夕照與夜晚路燈亮起，雨後鋪面變暗反光。畫面：`docs/art/evidence/m2/lighting-avenue.jpg`。陰影尺寸跟畫質設定，真機幀時間仍是 `pending-device`。

## 第 8 輪（狀態卡長條）— 2026-11-11

`node --test --test-name-pattern "statusbar shows current max"` 通過。`tsc --noEmit` 通過。可見短標籤不含「目前值」；`line` 仍含目前值、最大值、變化。專注 41.28 的短標籤是「專注 41.3/100」。

宮燈大道定步截圖（`scripts/art/capture-art.mjs` scenario `hud`，`hp 62 / focus 40 / xp 80`，回復後專注顯示 41.3）：

| 視窗 | 卡片文字 | 畫面 |
| --- | --- | --- |
| 1280×720 | 生命 62/108、專注 41.3/100 恢復、經驗 20/180 升級 | `docs/art/evidence/hud/status-desktop.jpg` |
| 390×780 | 同上；目標卡在狀態卡下方，經驗條未被蓋住 | `docs/art/evidence/hud/status-narrow.jpg` |

填色與墨色 `#102e32` 的對比：生命 `#e09a8c` 6.29、專注 `#8eb8b4` 6.63、經驗 `#ddc691` 8.61、空軌 `#cfc6b0` 8.47，皆高於 4.5。窄視窗與 reduced-motion 仍使用 `var(--ad-ink)` 與 `var(--ad-type)`。

提示改放在長條外面，`flex-wrap: wrap`。390×780 同時出現「受傷」「低生命」「恢復」時都能讀完，目標卡在 `top: 268px`，不蓋住經驗條。畫面：`docs/art/evidence/hud/status-narrow-warn.jpg`、`status-desktop-warn.jpg`。

## 第 9 輪（門口接到估計路網）— 2026-11-11

`node --test scripts/campus-links.test.mjs` 2 通過。`tsc --noEmit` 通過。41 個 `CAMPUS_SITES` 門口各有一條步道，起點是門口，終點距路網小於 1.6 m，路網本身是一個相連分量。視聽教育館與正門不再把步道目標放進建築碰撞裡。

定步畫面（高畫質，頁面無錯誤）：`docs/art/evidence/links/audiovisual-door.jpg`、`main-gate-door.jpg`。步道沿量體外側接到路，不是穿牆直線。座標仍是 estimated，沒有階數，不宣稱 1:1。
