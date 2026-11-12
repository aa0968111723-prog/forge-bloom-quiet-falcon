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

## 第 10 輪（軸線兩座警衛站）— 2026-11-11

`node --test scripts/axis-gates.test.mjs` 通過。`tsc --noEmit` 通過。大門與大忠警衛站的中心點半徑 0.6 m 不被碰撞推開，門柱中心會被推開。定步畫面：`docs/art/evidence/gates/main-gate.jpg`、`dazhong-gate.jpg`。紅柱、綠瓦橫樑，人站在開口裡。這是估計外形，不是實測門寬。

## 第 11 輪（白樓、覺軒與遠距細節）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。白樓是白牆平頂，覺軒是灰牆加綠瓦坡頂。窗帶、名牌和坡頂在高畫質 90 m 內才畫，省電是 48 m；量體一直留著。定步畫面：`docs/art/evidence/halls/white-hall.jpg`、`chuehhsuan.jpg`。精度仍是 estimated。

宿舍是暖色量體，實驗樓是冷灰量體加屋頂設備，游泳館是偏低的綠灰量體。教學樓是深色基座加淺色上層，橫樑在近處才畫。定步畫面：`docs/art/evidence/themes/sungtao.jpg`、`chemistry.jpg`、`swimming.jpg`、`docs/art/evidence/study/education.jpg`。都是 estimated，不是實測立面。大門與大忠警衛站仍是開口門柱。

## 第 12 輪（技能圖示與受擊邊緣）— 2026-11-11

`node --test scripts/skill-glyph.test.mjs` 通過。`tsc --noEmit` 通過。九個學院各有一個不重複的技能圖示。土木工程（工程）的快捷欄是製圖圓規，不再是同一顆星。受擊時 `.ad-hurt` 用較清楚的紅色內緣，狀態卡顯示「受傷」。定步畫面：`docs/art/evidence/icons/engineering.jpg`、`hurt.jpg`。頁面無錯誤。沒有新增音效。

## 第 13 輪（地圖七區圖例）— 2026-11-11

`node --test scripts/map-zones.test.mjs` 通過。`tsc --noEmit` 通過。校園地圖建物描邊跟清冊分區，圖例是軸線、書圖、理工、教學、文藝、運動、生活。分區框會重疊，所以玩家所在區用最近的建物，不把框線畫成實測界。課程標記仍在。定步打開地圖，頁面無錯誤：`docs/art/evidence/map/zones.jpg`。

## 第 14 輪（高畫質戶外三角形）— 2026-11-11

同一宮燈大道站點 `(0, -80)`、高畫質 1280×720、定步。詳細樹冠半徑 110 m 時 2,771,219 三角形、452 draw calls。改成 48 m 後 1,560,511 三角形、458 draw calls，低於 1.6 M。近處行道樹仍是細模。畫面：`docs/art/evidence/budget/avenue-high.jpg`。頁面無錯誤。戰鬥、室內、返回沒有重測。手機與 RTX 3060 仍是 `pending-device`。

## 第 15 輪（標題鏡頭）— 2026-11-11

`node --test scripts/title-camera.test.mjs` 通過。驚聲廣場環上最靠近標題鏡頭的榕樹已留出 16 m。定步標題畫面，頁面無錯誤：`docs/art/evidence/title/card.jpg`、`world.jpg`。廣場、銅像和宮燈教室不再被前景樹冠擋住。

## 第 16 輪（商管大樓量體）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。沿用的商管大樓剪影從通用灰塊改成教學樓的深色基座加淺色上層。精度仍是 estimated，不是實測立面。定步近景，頁面無錯誤：`docs/art/evidence/business/mass.jpg`。

## 第 17 輪（標示用字）— 2026-11-11

`node --test scripts/official-signs.test.mjs scripts/campus-registry.test.mjs` 通過。`tsc --noEmit` 通過。秘書處建物雙語頁只用來改兩個標示：科學館是「騮先紀念科學館」，泳館是「紹謨紀念游泳館」。沒有複製該表。座標與 `fieldChecked` 沒有改，精度仍是 estimated。定步名牌，頁面無錯誤：`docs/art/evidence/signs/science.jpg`、`swimming.jpg`。

## 第 18 輪（商管金幣與普攻蓄力）— 2026-11-11

`node --test scripts/art-pipeline.test.mjs scripts/art-runtime.test.mjs` 通過。`tsc --noEmit` 通過。只有一個命中點時，金幣彼此距離超過 0.8 m。蓄力幀刃的 local z 在 -0.5 之前，也就是身前。定步飛行幀，頁面無錯誤：`docs/art/evidence/coins/travel.jpg`。標示用字留在第 17 輪。

## 第 19 輪（淡水遠景）— 2026-11-11

`node --test scripts/river-vista.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。人站到河上會被推回近岸。地圖南北兩端、存在水裡的位置也回到可走的這一側，不會再被世界邊界推回去。對岸街廓與山脊都在岸線以西。牧羊草坪定步往西，頁面無錯誤：`docs/art/evidence/vista/west.jpg`。河面與山脊看得到。不是實測河寬或山形。金幣留在第 18 輪。

## 第 20 輪（同一條路線重測）— 2026-11-11

`scripts/art/capture-route.mjs`，高畫質 1280×720，靜態頁 `http://127.0.0.1:8108/`，遊戲程式 `7507c59`。頁面無錯誤。主機仍是 SwiftShader。戶外段只有 2 到 3 幀，幀時間不能拿去跟手機或 RTX 3060 比。PR #56 的數字是更早的開發頁量的，沒有抄進來。

| 段落 | 三角形 | draw calls |
| --- | --- | --- |
| 標題 | 1,204,683 | 453 |
| 戶外 | 1,562,527 | 461 |
| 戰鬥 | 1,495,745 | 455 |
| 室內 | 46,548 | 13 |
| 返回戶外 | 1,437,689 | 326 |

戶外四段都低於 1.6 M。畫面：`docs/art/evidence/route/outdoor.png`。原始數字：`docs/art/evidence/route/after-shore.json`。手機與 RTX 3060 仍是 `pending-device`。

## 第 21 輪（手機圖示）— 2026-11-11

`node --test scripts/touch-icons.test.mjs` 通過。窄於 700px 時工具鈕是 44×44，快捷欄圖示是 24px。觸控時快捷鈕不再縮到 38px。390×780 定步，頁面無錯誤，量到的工具鈕是 44px、快捷圖示是 24px：`docs/art/evidence/phone/icons.jpg`。路線重測留在第 20 輪。

## 第 22 輪（雨的畫質分級）— 2026-11-11

`node --test scripts/rain-tier.test.mjs` 通過。`tsc --noEmit` 通過。雨後預設會在鏡頭周圍下雨。高畫質 320 條，低畫質 64 條。室內不畫。減少動態時雨絲停住，場景已經開著再改系統設定也會停。同一宮燈大道站點、頁面無錯誤：`docs/art/evidence/rain/high.jpg`、`low.jpg`。手機圖示留在第 21 輪。真機幀時間仍是 pending-device。

## 第 23 輪（覺生綜合大樓）— 2026-11-11

`node --test scripts/context-lod.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。覺生綜合大樓是玻璃基座加退縮的淺色上層，上層窗帶貼著退縮後的牆，名牌寫著覺生綜合大樓。精度仍是 estimated。門口步道測試仍通過。定步近景，頁面無錯誤：`docs/art/evidence/integrated/hall.jpg`。雨留在第 22 輪。

## 第 24 輪（守謙國際會議中心）— 2026-11-11

`node --test scripts/context-lod.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。會議中心是低寬淺色量體、南向玻璃帶和出挑屋簷，名牌寫著守謙國際會議中心。沒有共用窗帶。精度仍是 estimated。定步近景，頁面無錯誤：`docs/art/evidence/forum/hall.jpg`。覺生綜合大樓留在第 23 輪。

## 第 25 輪（司令臺）— 2026-11-11

`node --test scripts/context-lod.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。司令臺從實驗樓改成低平台、後方小間和棚頂，不再畫窗帶。台面還不能走上去。精度仍是 estimated。定步畫面，頁面無錯誤：`docs/art/evidence/stand/deck.jpg`。會議中心留在第 24 輪。

## 第 26 輪（風洞廠房）— 2026-11-11

`node --test scripts/context-lod.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。風洞實驗室從實驗樓改成低長廠房，屋頂有風管和進氣箱，不再畫窗帶。化學館仍是實驗樓。風管尺寸仍是 estimated。定步畫面，頁面無錯誤：`docs/art/evidence/shed/duct.jpg`。司令臺留在第 25 輪。

## 第 27 輪（麗澤國際學舍）— 2026-11-11

`node --test scripts/context-lod.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。麗澤是淺灰綠牆、底層玻璃門廳和平頂橫樑，名牌寫著麗澤國際學舍。松濤仍是暖色宿舍。精度仍是 estimated。定步畫面，頁面無錯誤：`docs/art/evidence/reitaku/house.jpg`。風洞留在第 26 輪。

## 第 28 輪（傳播館）— 2026-11-11

`node --test scripts/context-lod.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。傳播館 O、Q 是深色基座、淺色上層和屋頂天線，不再是綠瓦坡頂。文學館仍是坡頂。名牌寫著傳播館 O 館。精度仍是 estimated。定步畫面，頁面無錯誤：`docs/art/evidence/media/o.jpg`。麗澤留在第 27 輪。

## 第 29 輪（視聽教育館）— 2026-11-11

`node --test scripts/context-lod.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。視聽教育館從綠瓦坡頂改成深色廳堂加舞台塔，名牌寫著視聽教育館。文學館仍是坡頂。舞台塔不是實測。定步畫面，頁面無錯誤：`docs/art/evidence/auditorium/hall.jpg`。傳播館留在第 28 輪。

## 第 30 輪（克難坡到三個門口）— 2026-11-11

`node --test scripts/route-walk.test.mjs scripts/campus-registry.test.mjs` 通過。`tsc --noEmit` 通過。三條巡禮折線以半徑 0.42 m 走到宮燈教室、圖書館、體育館門口。中線從坡底走到坡頂，人留在護牆之間。折線從銅像與海豚基座東側過，體育館從宮燈教室南緣、活動中心與教育館之間過。精度仍是 estimated，階數沒有展開，也沒有實測。沒有新增音效。視聽教育館留在第 29 輪。

## 第 31 輪（建築系館）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。建築系館是混凝土量體、南向玻璃、遮陽板和屋頂採光，名牌寫著建築系館。沒有共用窗帶，也沒有綠瓦。化學館仍是實驗樓。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/studio/hall.jpg`。巡禮折線留在第 30 輪。

## 第 32 輪（學生活動中心）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。學生活動中心是一層門廳、南向玻璃、遮陽板和退縮的上層，名牌寫著學生活動中心。沒有綠瓦，也沒有共用窗帶。覺軒仍是坡頂，會議中心仍是低寬會堂。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/activity/hall.jpg`。建築系館留在第 31 輪。

## 第 33 輪（勤務監控管制中心）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。勤務監控管制中心是低崗亭、南向窗和屋頂天線，名牌寫著勤務監控管制中心。沒有實驗樓的屋頂設備。化學館仍是實驗樓，大門仍是門柱。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/watch/post.jpg`。學生活動中心留在第 32 輪。

## 第 34 輪（工學大樓）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。工學大樓是深色基座加退縮的淺色塔樓，兩條窗帶貼著退縮的南牆，名牌寫著工學大樓。沒有實驗樓的屋頂設備。化學館仍是實驗樓。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/engineering/tower.jpg`。勤務監控留在第 33 輪。

## 第 35 輪（路網避開牆與門柱）— 2026-11-11

`node --test scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。半徑 0.42 m 可以走完估計路網的每一段中線。視聽教育館北牆外的路偏 1.6 m。大忠警衛站的路從兩根門柱中間穿，不再貼著東側門柱。門口仍能走到路網上。精度仍是 estimated。定步白天，頁面無錯誤：`docs/art/evidence/roads/hall.jpg`、`gate.jpg`。工學大樓留在第 34 輪。

## 第 36 輪（驚聲大樓）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。驚聲大樓是石色樓身、深色基座、底層玻璃和平頂壓簷，名牌寫著驚聲大樓。沒有綠瓦。文學館仍是坡頂。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/memorial/tower.jpg`。路網中線留在第 35 輪。

## 第 37 輪（紹謨紀念體育館）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。體育館是淺色館身、深色台基、高側窗和出挑平頂，名牌寫著紹謨紀念體育館。沒有圖書館外牆材質。泳館仍是綠灰運動館。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/gym/arena.jpg`。驚聲大樓留在第 36 輪。

## 第 38 輪（騮先紀念科學館）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。科學館是淺色館身、東側直玻璃和壓簷，名牌寫著騮先紀念科學館。沒有實驗樓的屋頂設備。化學館仍是實驗樓。未匯出的舊剪影沒有合併。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/science/hall.jpg`。體育館留在第 37 輪。

## 第 39 輪（背包穿模）— 2026-11-11

`node --test --test-name-pattern "backpack stays behind the jacket" scripts/art-pipeline.test.mjs` 通過。每個動作片段取 17 個時間點，比較背包正面的蒙皮頂點和同一高度的外套背面。最靠近的是 run，間隙 22.0 mm。背包骨轉 90 度會穿進 116.7 mm。沒有新增音效。科學館留在第 38 輪。

## 第 40 輪（工學館）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。工學館是磚紅基座、淺色上層、南向玻璃和屋頂小間，名牌寫著工學館。沒有實驗樓的屋頂設備。化學館仍是實驗樓。工學大樓仍是退縮塔樓。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/workshop/hall.jpg`。背包淨空留在第 39 輪。

## 第 41 輪（課程地圖標記）— 2026-11-11

`node --test scripts/lesson-marker.test.mjs` 通過。`tsc --noEmit` 通過。五個進行中的課程步驟各對應兩個字：選系、移動、補給、普攻、技能。完成與沒有課程時不寫字。字只畫在展開的校園地圖，小地圖仍是金圈。定步把課程設成移動、標記放在 (0, -80)，打開地圖，頁面無錯誤：`docs/art/evidence/map/lesson.jpg`。金圈上方看得到「移動」。工學館留在第 40 輪。沒有新增音效。

## 第 42 輪（紹謨紀念游泳館）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。紹謨紀念游泳館是深色基座、淺色長廳、南向高窗和屋頂長脊，名牌寫著紹謨紀念游泳館。沒有共用窗帶。高窗貼著南牆，長脊留在屋頂範圍內。水道長度仍待測。體育館仍是淺色館身。司令臺仍是低平台。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/pool/hall.jpg`。課程標記留在第 41 輪。沒有新增音效。

## 第 43 輪（行政大樓）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。行政大樓是石色樓身、深色基座、南向入口玻璃和兩條窗帶，名牌寫著行政大樓。沒有共用窗帶。入口玻璃貼著南牆，入口寬度小於樓寬。教育館、外語大樓與會文館仍是教學樓。舊的 admin-hall 不合併。精度仍是 estimated，入口位置仍待測。定步白天近景，頁面無錯誤：`docs/art/evidence/office/hall.jpg`。游泳館留在第 42 輪。沒有新增音效。

## 第 44 輪（實棟學人宿舍）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。實棟學人宿舍是淺色樓身、南向門廊和兩條窗帶，名牌寫著實棟學人宿舍。沒有松濤那種屋頂量體，也沒有共用窗帶。門廊貼著南牆，寬度小於樓寬。松濤一館到五館仍是宿舍，麗澤仍是國際學舍。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/faculty/house.jpg`。行政大樓留在第 43 輪。沒有新增音效。

## 第 45 輪（濯纓苑／校史館）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。濯纓苑／校史館是白牆、木色基座、綠瓦坡頂和南向迴廊，名牌寫著濯纓苑／校史館。沒有圖書館外牆，坡頂也比學術樓的錐頂收得更緊。迴廊貼著南牆。白牆從木色基座頂接到坡頂底。文學館與覺軒仍是坡頂。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/garden/house.jpg`。實棟學人宿舍留在第 44 輪。沒有新增音效。

## 第 46 輪（外國語文大樓）— 2026-11-11

`node --test scripts/context-lod.test.mjs` 通過。`tsc --noEmit` 通過。外國語文大樓是暖色底層、南向長廊玻璃和退縮的淺色上層，名牌寫著外國語文大樓。上層窗帶貼著退縮的牆，沒有共用窗帶。教育館與會文館仍是教學樓。舊的 foreign-lang-hall 不合併。精度仍是 estimated。定步白天近景，頁面無錯誤：`docs/art/evidence/language/hall.jpg`。濯纓苑留在第 45 輪。沒有新增音效。

## 第 47 輪（植栽距離）— 2026-11-12

`node --test scripts/planting-lod.test.mjs` 通過。`tsc --noEmit` 通過。距離 48 m 以內的植株留在近景，正好 48 m 和更遠的進遠景。樹木與灌木近景用模型，遠景改便宜樹冠。杜鵑、花圃、地被和青苔超出距離就不畫。棕櫚超出距離留便宜樹冠。定步白天站在宮燈大道，頁面無錯誤：`docs/art/evidence/planting/avenue.jpg`。近處看得到圓灌木和粉紅花圃。植栽位置仍是 estimated。外國語文大樓留在第 46 輪。沒有新增音效。

## 第 48 輪（肩肘膝）— 2026-11-12

`node --test --test-name-pattern "shoulders, elbows and knees" scripts/art-pipeline.test.mjs` 通過。每個動作片段取 17 個時間點，讀肩、肘、膝的本地旋轉。膝最多彎 94 度，肘最多彎 97 度，肩最多前舉 166 度。膝往後折到 -1.2 rad、肘往反方向折到 1.2 rad、肩再舉到 -3.5 rad，測試都會失敗。沒有新增音效。植栽距離留在第 47 輪。

## 第 49 輪（鍾靈化學館）— 2026-11-12

`node --test scripts/context-lod.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。鍾靈化學館是深色基座、淺色館身、南向玻璃和屋頂排氣箱，名牌寫著鍾靈化學館。沒有共用窗帶。玻璃貼著南牆，排氣箱留在屋頂範圍內。科學館仍是東側直玻璃，工學館仍是磚紅基座，工學大樓仍是退縮塔樓。精度仍是 estimated。門口步道測試仍通過。定步白天近景，頁面無錯誤：`docs/art/evidence/chem/hall.jpg`。肩肘膝留在第 48 輪。沒有新增音效。

## 第 50 輪（路燈淨空）— 2026-11-12

`node --test scripts/prop-clearance.test.mjs` 通過。`tsc --noEmit` 通過。每一盞路燈的中心都在碰撞體外面。商管大樓那盞在南牆外，z 大於 -171。海事博物館那盞在南牆外，z 大於 -242。圖書館名牌朝南，z 在南牆外側。定步白天，頁面無錯誤：`docs/art/evidence/props/business.jpg`、`museum.jpg`。兩盞燈都站在牆前的草地上。位置仍是 estimated。化學館留在第 49 輪。沒有新增音效。`build:site` 產物 `AdventureApp-CBoDD94C.js`。

## 第 51 輪（圖書館坡道）— 2026-11-12

`node --test scripts/library-ramp.test.mjs` 通過。`tsc --noEmit` 通過。坡道北端在圖書館南牆外 0.4 m 以內，高度是 1.05 m。南端貼地。坡道外側 0.5 m 裙邊收到 0。頂面法線朝上。網格頂點用的是走路高度，坡端和裙邊中點的網格與腳底相差小於 2 cm。人站在坡面上。定步白天從南端看，頁面無錯誤：`docs/art/evidence/ramp/slope.jpg`。同一站點量到北端地面 20.74、南端 19.51、坡外 19.59。坡度仍是 estimated。路燈淨空留在第 50 輪。沒有新增音效。`build:site` 產物 `AdventureApp-BLw17Z0-.js`。

## 第 52 輪（球場不種樹）— 2026-11-12

`node --test scripts/court-clearing.test.mjs` 通過。`tsc --noEmit` 通過。密度 1 的散佈樹沒有一棵落在球場、田徑場或停車場裡面，五虎崗外緣 2.9 m 內也沒有。定步白天俯看，頁面無錯誤：`docs/art/evidence/courts/open.jpg`。草皮是空的，樹在場外。植栽位置仍是 estimated。圖書館坡道留在第 51 輪。沒有新增音效。`build:site` 產物 `AdventureApp-D2eWEjyb.js`。

## 第 53 輪（雨後場地）— 2026-11-12

`node --test scripts/wet-surface.test.mjs` 通過。`tsc --noEmit` 通過。晴天的球場草色是 `#5d8a52`。雨後把顏色乘小，亮度下降，粗糙度也下降。停車場和跑道同樣變暗、變滑。這些顏色比材質庫的濕灰還深，所以不把灰色混進去。同一鏡頭的五虎崗，頁面無錯誤：`docs/art/evidence/courts/field-day.jpg`、`field-wet.jpg`。不是實測日照。球場不種樹留在第 52 輪。沒有新增音效。`build:site` 產物 `AdventureApp-Bw3-LFcW.js`。

## 第 54 輪（綜合球場標線）— 2026-11-12

`node --test scripts/court-lines.test.mjs` 通過。`tsc --noEmit` 通過。五虎崗綜合球場有兩塊場，各四條邊線和一條中線，中線上有球網。排球場有一圈邊線。每條線都在草皮範圍內。田徑場和停車場沒有這些線。定步白天俯看，頁面無錯誤：`docs/art/evidence/courts/wuhu.jpg`。看得到兩塊白線場。標線尺寸仍是 estimated。雨後場地留在第 53 輪。沒有新增音效。`build:site` 產物 `AdventureApp-DCYaPlp2.js`。

## 第 55 輪（覺軒花園）— 2026-11-12

`node --test scripts/garden-pavilion.test.mjs` 通過。`tsc --noEmit` 通過。覺軒花園是 pavilion。中心點以半徑 0.42 m 不會被推開。四根角柱會擋住人。另一筆覺軒仍是 hip-roof-block。散佈的樹不落在亭子外緣 4 m 內。定步白天，頁面無錯誤：`docs/art/evidence/pavilion/open.jpg`。看得到綠瓦頂、紅柱和鋪面。外形仍是 estimated。綜合球場標線留在第 54 輪。沒有新增音效。`build:site` 產物 `AdventureApp-DzP7Xkfy.js`。

## 第 56 輪（小地圖課程字）— 2026-11-12

`node --test scripts/lesson-marker.test.mjs` 通過。`tsc --noEmit` 通過。進行中的課程在小地圖左下角寫兩個字。展開地圖仍把同樣的字寫在金圈上方。窄視窗的課程條在小地圖下方。狀態卡仍是短標籤長條。沒有新增音效。覺軒花園留在第 55 輪。`build:site` 產物 `AdventureApp-BM0-cuW7.js`。

## 第 57 輪（圖書館坡道欄杆）— 2026-11-12

`node --test scripts/ramp-rails.test.mjs` 通過。`tsc --noEmit` 通過。圖書館坡道長 14 m，左右各一道同長欄杆，離坡道中線 0.95 m，在 1.6 m 寬的坡面外側。立柱含兩端，至少 8 根。欄杆用現在的坡道位置，不回到舊的南牆座標。克難坡沒有欄杆。定步白天近景，頁面無錯誤：`docs/art/evidence/ramp/rails.jpg`。兩側都看得到橫桿和立柱。欄杆位置仍是 estimated。小地圖課程字留在第 56 輪。沒有新增音效。`build:site` 產物 `AdventureApp-Cl3Ho6pe.js`。390×780 也看得到兩側欄杆：`docs/art/evidence/ramp/rails-narrow.jpg`。

## 第 58 輪（欄杆擋人）— 2026-11-12

`node --test scripts/ramp-rails.test.mjs scripts/library-ramp.test.mjs scripts/campus-links.test.mjs` 通過。`tsc --noEmit` 通過。半徑 0.42 m 站在坡道中線不被推開。站在東側欄杆 x=-1.05 會被推到 x=-1.530，移開 0.48 m。南端外 1.2 m 的入口也不被推開。估計路網仍是一個相連的格網。克難坡仍沒有欄杆。沒有新增音效。欄杆留在第 57 輪。`build:site` 產物 `AdventureApp-C6frxvLx.js`。

## 第 59 輪（欄杆跟著坡）— 2026-11-12

`node --test scripts/ramp-rails.test.mjs` 通過。`tsc --noEmit` 通過。同一道欄杆的北側柱腳高於南側。連接兩端的桿，本地 +Z 對準這段升高。立柱的 X 仍落在 0.12 m 的碰撞上。克難坡仍沒有欄杆。定步白天，頁面無錯誤：`docs/art/evidence/ramp/slope-rails.jpg`。橫桿沿著坡面上去。位置仍是 estimated。欄杆留在第 57 輪的位置。沒有新增音效。

## 第 60 輪（消防栓）— 2026-11-12

`node --test scripts/hydrant-stop.test.mjs scripts/route-walk.test.mjs scripts/world-data.test.mjs` 通過。`tsc --noEmit` 通過。七個消防栓和網格用同一組座標，直徑 0.3 m。半徑 0.42 m 站在坡底栓心會被推開。栓東 1.2 m、主巡禮和三條折線的轉折點不被推開。折線走完全程仍到得了門口。路燈離栓超過 1.2 m。定步白天從南邊走向坡底消防栓，頁面無錯誤，停在 z=92.77：`docs/art/evidence/props/hydrant.jpg`。栓位仍是 estimated。欄杆跟著坡留在第 59 輪。沒有新增音效。`build:site` 產物 `AdventureApp-DfUs6w45.js`。
