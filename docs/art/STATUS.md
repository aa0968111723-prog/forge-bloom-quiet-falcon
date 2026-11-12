# 進度狀態

更新：2026-11-11。分支 `cursor/tamkang-art-pipeline-1a71`。
本文件分開報告「遊戲美術完成度」「真實地理精度」「待真機驗收」，不以文件或檔名數量推算完成率。

## 階段：基準盤點 → 資產管線 → 可玩樣板（本輪）

### 實際完成

1. **基準盤點**：`docs/art/BASELINE.md`；改造前五段路線效能與畫面（`docs/art/evidence/baseline/`）。
2. **資產管線**：`art/` 可編輯來源 → `npm run art:export` → `public/game-art/*.glb` + `manifest.json` + `src/game/art/art-manifest.gen.ts`；
   `npm run art:validate -- --rebuild` 檢查缺檔、ID 重複、無效引用、骨架動畫相容、預算、未使用與重建一致；`scripts/art-pipeline.test.mjs` 納入 `npm test`。
3. **精製主角**（`char.student-kit`，玩家角色已改用）：動漫臉（貼圖眼、眉、腮紅）、分束深栗頭髮與小束髮、米白上衣、玉綠開襟外套（領子、11 mm 布料厚度、翻折袖口）、手指、米色短褲、白球鞋（玉綠中底與側條）、帆布背包（揹帶、扣具）與會擺動的小龜吊飾。
   8 段動畫：idle、walk、run、attack、skill、dodge、hurt、interact；由真實事件觸發，依身體部位分層。
   省電畫質改用同骨架、同動畫的 LOD1（`char.student-kit-lod1`）。
4. **考卷怪**（`creature.quiz`，所有 quiz 敵人已改用）：會捲曲的考卷身體、印刷臉、手風琴紙手與鉛筆、折角、環繞小考卷；
   idle／chase／windup（依真實進度）／attack／hurt／defeat；紅筆預警圈＝真實判定半徑；紙片與擊倒碎紙特效。
5. **工程技能「結構脈衝」**：藍圖格 → 桁架波前到真實範圍 → 命中鋼梁沿真實擊退方向 → 消散；冷卻結束的就緒提示；低畫質與 reduced-motion 版本。
6. **截圖與量測工具**：`capture-art.mjs`（turnaround、poses、combat）、`capture-route.mjs`、`?qa=1` 定步時鐘。

### 提交

| 提交 | 內容 |
| --- | --- |
| `cad192d` | 基準盤點、QA store 接口、路線量測 |
| `cbec4f6` | 資產管線、學生角色組主角、分層動畫器、載入回退 |
| `93ed99b` | 考卷怪、結構脈衝、QA 定步時鐘 |
| `bad40fa` | 主角省電 LOD1 |
| （本次文件提交） | 狀態、驗收、來源、問題、交接、證據 |

### 驗收證據

- 自動檢查：typecheck 通過；`npm test` 215 通過（基準 206 + 新增 9）；`art:validate --rebuild` 0 錯誤；`build:site` 通過。詳見 `VALIDATION.md`。
- 主遊戲畫面（定步、真實規則）：`docs/art/evidence/m1/combat-*.jpg`（追擊、預警 30／80 %、出手、受擊、普攻、技能六格時序、擊倒四格）。
- 主角固定光照四面與特寫、六個動作關鍵影格：`docs/art/evidence/m1/protagonist-*.jpg`。
- 一般桌面 Chrome 實際遊玩（人工操作）：`docs/art/evidence/m1/realplay/`（地圖前往宮燈教室、預警圈、結構脈衝命中「命中 1 個目標」、擊倒與掉落）。

### 同主機、同解析度、同路線比較

主機：4 vCPU Xeon、無 GPU、Chrome SwiftShader。手機與 RTX 3060 目標一律 `pending-device`。
資料：`docs/art/evidence/baseline/*.json`（前）、`docs/art/evidence/m1/route/*.json`（後）。

**省電 844×390**（frame median／P95 ms；三角形）

| 段落 | 改造前 | M1（主角 LOD0） | M1 + LOD1（現行） |
| --- | --- | --- | --- |
| 首頁 | 633／700；374 k | 900／917；392 k | 692／833；380 k |
| 戶外 | 675／733；352 k | 775／800；363 k | 650／750；351 k |
| 戰鬥 | 683／750；343 k | 775／1083；355 k | 642／783；344 k |
| 室內 | 33.3／50；15.5 k | 50／66.7；24.2 k | 33.3／50；12.4 k |
| 返回戶外 | 483／583；339 k | 558／683；349 k | 483／550；337 k |
| draw calls（室內） | 16 | 11 | 11 |
| 傳輸（未壓縮） | 1.54 MB／49 檔 | 2.86 MB／51 檔 | 2.35 MB／51 檔 |
| 開頁到標題可用 | 6.4 s | 5.9 s | 6.0 s |

**高畫質 1280×720**（主角 LOD0）

| 段落 | 改造前 | M1 |
| --- | --- | --- |
| 首頁 | 3817／3833；1.91 M；515 calls | 3925／3983；1.93 M；510 calls |
| 戶外 | 3958／4067；2.74 M；508 calls | 4325／4700；2.76 M；493 calls |
| 戰鬥 | 4158／4317；2.75 M；506 calls | 4083／4083；2.77 M；491 calls |
| 室內 | 183／217；28.5 k；23 calls | 200／267；45.9 k；13 calls |
| 返回戶外 | 3658／3817；2.74 M；363 calls | 3617／3683；2.75 M；348 calls |
| 傳輸（未壓縮） | 4.63 MB | 5.95 MB |

判讀：
- 省電畫質：主角 LOD0 讓本主機變慢；改用 LOD1 後回到改造前水準（室內 33.3／50 ms），draw calls 仍較少。
- 高畫質：每段只有 2–4 幀樣本，差異在雜訊範圍；室內三角形增加主要來自主角含陰影的兩次繪製。
- 參考目標（手機省電 median ≤ 33.3／P95 ≤ 50 ms；桌面高畫質 ≤ 16.7／25 ms）尚未在目標裝置量測：`pending-device`。

## 三種完成度（分開報告）

| 面向 | 現況 |
| --- | --- |
| 遊戲美術完成度 | M1 樣板、五名清冊 NPC、四種怪物、九學院技能與九種施放姿勢都在主遊戲運作，標 `needs_review`。狀態卡讀數已改成短標籤長條。門口步道改接到估計路網上能站的點。七區、技能圖示與受擊回饋、音效未完成。 |
| 真實地理精度 | 清冊已從目前程式重新產生（`docs/art/registry.json`）。與基準比對沒有增刪：仍是 64 筆、4 個別名、60 筆非別名，全部 `estimated`。沒有實測，不宣稱 1:1。 |
| 待真機驗收 | 手機省電與 RTX 3060 高畫質 FPS、溫度、觸控：`pending-device`。日、夕、夜、雨後已在本機軟體算繪留同站點畫面，不能當成目標裝置的幀時間。 |

## 階段：主角精修、NPC 角色組、三種怪物（本輪）

### 實際完成

1. **主角精修（ART-025）**：鞋楦加高、圓頭、橡膠鞋頭與鞋尖上翹；手指分開並微彎。被牆或高台擋住時，控制器速度仍為 0，動畫改播約 45% 意圖速度的原地步伐。
2. **NPC 角色組（ART-030／031）**：`char.npc-kit` 25 個部件共用主角骨架與 8 段動畫。五名步行者各一組預設（新生、建築系學長、外語系同學、研究生、體育課學生），執行期著色、合併成一個 draw call，並依體型縮放胸骨。140 m 外不繪製。載入失敗仍用舊程序化學生。
3. **三種怪物（ART-040～042）**：分組報告聚合體、期中考監視者、期末截止日鬧鐘。各自輪廓、atlas、idle／chase／windup／attack／hurt／defeat。`CreatureActor` 只讀敵人狀態；預警圓等於 `radius + 2.5`。數值與 AI 未改。
4. **舊巡禮敵人（ART-043）**：`CampusGame` 沒有路由掛載，不升級、不刪除。
5. **審查修正**：衝刺時頭部注視不再每幀累加；卸載實例時釋放複製骨架的骨骼貼圖。

### 提交

`e3537e0` NPC 與主角精修、`f7c9953` lint、`6fec50b` 三種怪物、`7ec1984` 頭部注視與骨架釋放。

### 驗收證據

- `npm test` 219 通過（含 NPC 部件、清冊差異、剪影重疊、注視不累加、骨架只釋放一次）。`art:validate --rebuild` 0 錯誤。
- 畫面：`docs/art/evidence/m2/`。戰鬥紀錄：report 玩家血量 100→84、怪 145→125→0；exam 100→78、240→220→0；final 100→72、520→500→0。風向預警分別在真實前搖 40% 與 85%。

## 未完成與受阻

- 受阻：Blender 往返（無 Blender）、真機量測（無裝置）、授權音效（無來源）、核准概念圖（任務包不在儲存庫）。
- 未完成：七區與清冊處置、公共室內、環境道具、技能圖示與受擊回饋、音效、壓縮。地理精度仍全部 `estimated`。狀態卡純文字讀數已改（見下方）。

## 階段：八學院技能

八種技能各有形狀，讀取真正的 `attackFx.range` 與 `hits`，打到範圍後淡出。回復類另有一道回到玩家的脈衝。低畫質少畫標記；reduced-motion 一開始就是全範圍。敵人的紅色預警仍畫在上面。畫面：`docs/art/evidence/m2/college-skills.jpg`。`npm test` 222 通過。

## 階段：狀態卡讀數（ART-090 的一部分）

生命、專注、經驗的可見文字改成「生命 62/108」。數字最多一位小數，所以專注回復中的 41.28 顯示成 41.3，不會把長小數撐出卡片。長句「目前值／最大值／變化」留在 `aria-label`。長條用淺軌（`#cfc6b0`）與仍能讓墨色 `#102e32` 達到 4.5 對比的填色：生命 `#e09a8c`、專注 `#8eb8b4`、經驗 `#ddc691`。窄視窗（390×780）的目標卡從 `top: 160px` 改到 `208px`，整條經驗條留在狀態卡裡。

畫面：`docs/art/evidence/hud/status-desktop.jpg`、`status-narrow.jpg`。狀態列測試斷言短標籤不含「目前值」，整數仍寫出目前值/最大值，41.28 的短標籤是「專注 41.3/100」。

## 階段：門口接到估計路網（ART-069 的一部分）

每個校園門口改成走到路網上實際能站的點，不再對準同一條垂直線。視聽教育館與正門原先的目標點落在建築碰撞裡，步道會穿牆或停在路外。現在這兩處都沿量體外側接到路。路網仍是一個相連的估計格網，精度不是 surveyed，階數沒有量。

畫面：`docs/art/evidence/links/`。測試：`scripts/campus-links.test.mjs`。

## 階段：商管大樓改成教學樓量體（ART-062 的一部分）

清冊裡的商管大樓標記 `existing`，所以畫面上用的是舊剪影，不是後來的教學樓基座。這棟現在跟其他教學樓一樣：深色基座、淺色上層、近處橫樑。座標與外形仍是 estimated。

畫面：`docs/art/evidence/business/mass.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：兩個標示對上秘書處用字（ART-061 的一部分）

2026-11-11 讀了秘書處建物雙語頁。科學館標示改為「騮先紀念科學館」，泳館改為「紹謨紀念游泳館」。該頁沒有座標，清冊精度仍全部 estimated，也沒有把整張表複製進庫。校園圖 PDF 還沒逐棟判讀。商管大樓仍是教學樓基座。

畫面：`docs/art/evidence/signs/science.jpg`、`swimming.jpg`。測試：`scripts/official-signs.test.mjs`。

## 階段：商管金幣散開（KI-06）

打到同一個目標時，金幣沿圓周散開，不再疊在同一個點。普攻蓄力幀的刃改到身前。定步飛行畫面：`docs/art/evidence/coins/travel.jpg`。標示用字與商管大樓基座留著。

## 階段：淡水遠景不可走（ART-070）

牧羊草坪往西看得到河面和山脊。近岸在估計的 x=-112 停住，對岸街廓和山都在這條線以西。河寬和山形都不是實測。金幣仍會散開。

畫面：`docs/art/evidence/vista/west.jpg`。測試：`scripts/river-vista.test.mjs`。

## 階段：同一條路線的高畫質三角形

樹冠改短之後，在現在的靜態頁重測。標題、戶外、戰鬥、返回都低於 1.6 M。室內是 46.5 k。幀時間仍是這台軟體算繪，不是手機或 RTX 3060。遠景與金幣留著。

畫面：`docs/art/evidence/route/outdoor.png`。數字：`docs/art/evidence/route/after-shore.json`。

## 階段：手機寬度的圖示（ART-091）

390×780 時右上工具鈕是 44px，快捷欄的技能圖示是 24px。觸控窄螢幕不再把快捷鈕縮到 38px。戶外路線仍低於 1.6 M。

畫面：`docs/art/evidence/phone/icons.jpg`。測試：`scripts/touch-icons.test.mjs`。

## 階段：雨的畫質分級（ART-087）

雨後預設會在戶外鏡頭周圍下雨。高畫質 320 條，低畫質 64 條。室內不畫。減少動態時雨絲停住。真機幀時間仍是 pending-device。手機圖示留著。

畫面：`docs/art/evidence/rain/high.jpg`、`low.jpg`。測試：`scripts/rain-tier.test.mjs`。

## 階段：覺生綜合大樓（ART-063 的一部分）

書圖區這棟從教學樓基座改成玻璃基座加退縮的淺色上層。上層窗帶貼著退縮後的牆。圖書館和驚聲大樓仍用既有量體。外形仍是 estimated。

畫面：`docs/art/evidence/integrated/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：守謙國際會議中心（ART-066 的一部分）

文藝區這棟從教學樓基座改成低寬淺色量體、南向玻璃帶和出挑屋簷。海事博物館仍是船型。外形仍是 estimated。覺生綜合大樓留著。

畫面：`docs/art/evidence/forum/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：司令臺（ART-067 的一部分）

運動區的司令臺不再是實驗樓。現在是低平台、後方小間和棚頂。台面還不能走上去。外形仍是 estimated。會議中心留著。

畫面：`docs/art/evidence/stand/deck.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：風洞廠房（ART-064 的一部分）

理工區的風洞實驗室不再是實驗樓。現在是低長廠房，屋頂有一條風管和一端的進氣箱。化學館仍是實驗樓。風管尺寸仍是 estimated。司令臺留著。

畫面：`docs/art/evidence/shed/duct.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：麗澤國際學舍（ART-068 的一部分）

生活區的麗澤從暖色宿舍改成淺灰綠牆、底層玻璃門廳和平頂橫樑。松濤仍是暖色宿舍。外形仍是 estimated。風洞留著。

畫面：`docs/art/evidence/reitaku/house.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：傳播館（ART-065 的一部分）

教學區的傳播館 O、Q 不再是綠瓦坡頂。現在是深色基座、淺色上層和屋頂天線。文學館仍是坡頂。天線不是實測。麗澤留著。

畫面：`docs/art/evidence/media/o.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：視聽教育館（ART-066 的視聽部分）

文藝區這棟從綠瓦坡頂改成深色廳堂，屋頂一端有舞台塔。文學館仍是坡頂。舞台塔不是實測。傳播館留著。

畫面：`docs/art/evidence/auditorium/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：克難坡到三個門口（ART-069 的一部分）

三條巡禮折線不再穿過驚聲銅像基座。體育館那條改從宮燈教室南緣，再從學生活動中心與教育館之間走到門口。克難坡中線可以從坡底走到坡頂。座標與階數仍是 estimated。視聽教育館留著。

測試：`scripts/route-walk.test.mjs`。

## 階段：建築系館（ART-064 的一部分）

理工區這棟不再跟著文藝主題戴綠瓦。現在是混凝土量體、南向玻璃、遮陽板和屋頂採光。化學館仍是實驗樓。外形仍是 estimated。風洞與巡禮折線留著。

畫面：`docs/art/evidence/studio/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：學生活動中心（ART-066 的一部分）

文藝區這棟不再跟著文藝主題戴綠瓦。現在是一層門廳、南向玻璃、遮陽板和退縮的上層。分區仍是 culture-58。會議中心仍是低寬會堂，覺軒仍是坡頂。外形仍是 estimated。建築系館留著。

畫面：`docs/art/evidence/activity/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：勤務監控管制中心（ART-062 的一部分）

軸線上這棟不再是一層的實驗樓。現在是低崗亭、南向窗和一根屋頂天線。大門與大忠警衛站仍是開口門柱。化學館仍是實驗樓。外形仍是 estimated。學生活動中心留著。

畫面：`docs/art/evidence/watch/post.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：工學大樓（ART-064 的一部分）

理工區這棟現在是深色基座加退縮的淺色塔樓，窗帶貼著退縮的牆。化學館仍是實驗樓。外形仍是 estimated。勤務監控留著。

畫面：`docs/art/evidence/engineering/tower.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：路網避開牆與門柱（ART-069 的一部分）

估計路網有兩段中線貼著實體。視聽教育館北牆那一段改從牆外 1.6 m 走。大忠警衛站那一段改從門洞中間走。半徑 0.42 m 可以走完。座標仍是 estimated。工學大樓與巡禮折線留著。

畫面：`docs/art/evidence/roads/hall.jpg`、`gate.jpg`。測試：`scripts/campus-links.test.mjs`。

## 下一步

## 階段：驚聲大樓（ART-063 的一部分）

書圖區這棟不再是八層樓上的綠瓦錐頂。現在是石色樓身、深色基座、底層玻璃和平頂壓簷。文學館仍是坡頂。覺生綜合大樓仍是玻璃基座加退縮上層。外形仍是 estimated。路網中線留著。

畫面：`docs/art/evidence/memorial/tower.jpg`。測試：`scripts/context-lod.test.mjs`。

## 下一步

## 階段：紹謨紀念體育館（ART-067 的一部分）

運動區這棟不再用圖書館的外牆材質。現在是淺色館身、深色台基、南向高側窗和出挑平頂。泳館仍是綠灰運動館。司令臺仍是低平台。外形仍是 estimated。驚聲大樓留著。

畫面：`docs/art/evidence/gym/arena.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：騮先紀念科學館（ART-064 的一部分）

理工區這棟現在是淺色館身、東側直玻璃和壓簷，沒有屋頂設備。化學館仍是實驗樓。未匯出的舊剪影沒有合併。外形仍是 estimated。工學大樓、建築系館與體育館留著。

畫面：`docs/art/evidence/science/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：背包穿模（ART-034 的一部分）

每個動作片段的背包正面都留在外套後面。最靠近的是 run，間隙 22.0 mm。只量背包骨原點不會抓到旋轉穿模，所以這輪改量蒙皮頂點。把背包骨轉 90 度會穿進外套。騮先紀念科學館留著。

測試：`scripts/art-pipeline.test.mjs`。

## 階段：工學館（ART-064 的一部分）

理工區這棟現在是磚紅基座、淺色上層、南向玻璃和屋頂小間。化學館仍是實驗樓。工學大樓仍是退縮塔樓。外形仍是 estimated。背包淨空留著。

畫面：`docs/art/evidence/workshop/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：課程地圖標記（ART-090 的一部分）

展開的校園地圖在課程金圈上方寫兩個字。進行中的步驟是選系、移動、補給、普攻、技能。小地圖仍只畫金圈。工學館仍是磚紅基座和屋頂小間。

畫面：`docs/art/evidence/map/lesson.jpg`。測試：`scripts/lesson-marker.test.mjs`。

## 下一步

見 `CHECKPOINT.json`。課程標記在展開地圖上可讀。工學館、化學館與工學大樓留著。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。
