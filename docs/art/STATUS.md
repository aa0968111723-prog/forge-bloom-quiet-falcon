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

## 階段：驚聲大樓（ART-063 的一部分）

書圖區這棟不再是八層樓上的綠瓦錐頂。現在是石色樓身、深色基座、底層玻璃和平頂壓簷。文學館仍是坡頂。覺生綜合大樓仍是玻璃基座加退縮上層。外形仍是 estimated。路網中線留著。

畫面：`docs/art/evidence/memorial/tower.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：紹謨紀念體育館（ART-067 的一部分）

運動區這棟不再用圖書館的外牆材質。現在是淺色館身、深色台基、南向高側窗和出挑平頂。司令臺仍是低平台。外形仍是 estimated。驚聲大樓留著。

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

展開的校園地圖在課程金圈上方寫兩個字。進行中的步驟是選系、移動、補給、普攻、技能。小地圖左下角也寫這兩個字。工學館仍是磚紅基座和屋頂小間。

畫面：`docs/art/evidence/map/lesson.jpg`。測試：`scripts/lesson-marker.test.mjs`。

## 階段：紹謨紀念游泳館（ART-067 的一部分）

運動區這棟現在是深色基座、淺色長廳、南向高窗和屋頂長脊。體育館仍是淺色館身。司令臺仍是低平台。水道長度仍待測。外形仍是 estimated。課程標記留著。

畫面：`docs/art/evidence/pool/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：行政大樓（ART-066 的一部分）

文藝區這棟現在是石色樓身、深色基座、南向入口玻璃和兩條窗帶。教育館、外語大樓與會文館仍是教學樓。舊的 admin-hall 不合併。入口位置仍待測。外形仍是 estimated。游泳館留著。

畫面：`docs/art/evidence/office/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：實棟學人宿舍（ART-068 的一部分）

生活區這棟不再跟松濤共用暖色宿舍和屋頂量體。現在是淺色樓身、南向門廊和兩條窗帶。松濤一館到五館仍是宿舍。麗澤仍是國際學舍。外形仍是 estimated。行政大樓留著。

畫面：`docs/art/evidence/faculty/house.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：濯纓苑／校史館（ART-066 的一部分）

文藝區這棟不再用圖書館的外牆。現在是白牆、木色基座、收緊的綠瓦坡頂和南向迴廊。白牆從木色基座頂接到坡頂底。文學館與覺軒仍是坡頂。外形仍是 estimated。實棟學人宿舍留著。

畫面：`docs/art/evidence/garden/house.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：外國語文大樓（ART-065 的一部分）

教學區這棟不再跟教育館共用教學樓基座。現在是暖色底層、南向長廊玻璃和退縮的淺色上層。教育館與會文館仍是教學樓。舊的 foreign-lang-hall 不合併。長廊外形仍是 estimated。濯纓苑留著。

畫面：`docs/art/evidence/language/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：植栽距離（ART-085）

宮燈大道近處看得到杜鵑、灌木和花圃。樹木與灌木在高畫質 48 m 內用模型，外面改便宜樹冠。杜鵑、花圃、地被和青苔超出距離就不畫。棕櫚超出距離留便宜樹冠。植栽位置仍是 estimated。外國語文大樓留著。

畫面：`docs/art/evidence/planting/avenue.jpg`。測試：`scripts/planting-lod.test.mjs`。

## 階段：肩肘膝（ART-034 的一部分）

每個動作片段的肩、肘、膝都留在量到的彎曲範圍。膝最多彎 94 度，肘最多彎 97 度，肩最多前舉 166 度。膝往後折、肘往反方向折、肩再多舉，測試會失敗。植栽距離留著。

測試：`scripts/art-pipeline.test.mjs`。

## 階段：鍾靈化學館（ART-064 的一部分）

理工區這棟不再是共用的實驗樓方塊。現在是深色基座、淺色館身、南向玻璃和屋頂排氣箱。科學館仍是東側直玻璃，工學館仍是磚紅基座，工學大樓仍是退縮塔樓。外形仍是 estimated。肩肘膝留著。

畫面：`docs/art/evidence/chem/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 階段：路燈淨空（ART-084 的一部分）

路燈中心若落在實體裡，會沿最近的一面推到牆外 1.2 m。商管大樓和海事博物館各有一盞從樓裡移到南牆外。圖書館名牌改朝南，貼在南牆外側。位置仍是 estimated。化學館仍是淺色館身和屋頂排氣箱。

畫面：`docs/art/evidence/props/business.jpg`、`museum.jpg`。測試：`scripts/prop-clearance.test.mjs`。

## 階段：圖書館坡道（ART-084 的一部分）

前廣場的坡道從南端貼地升到北端 1.05 m，接到台基前。北端停在南牆外。坡道外側 0.5 m 內高度收到地面。人站在這道坡上。坡度仍是 estimated。路燈仍停在牆外。

畫面：`docs/art/evidence/ramp/slope.jpg`。測試：`scripts/library-ramp.test.mjs`。

## 階段：球場不種樹（ART-085 的一部分）

散佈的樹不再落進球場、田徑場和停車場，外緣再留 3 m。五虎崗的草皮是空的，樹留在場外。植栽位置仍是 estimated。圖書館坡道留著。

畫面：`docs/art/evidence/courts/open.jpg`。測試：`scripts/court-clearing.test.mjs`。

## 階段：雨後場地（ART-086 的一部分）

沒有貼圖的球場、停車場和跑道在雨後把顏色乘小，亮度下降、粗糙度下降。晴天顏色維持原來的綠、灰和磚紅。這些顏色比材質庫的濕灰還深，所以不把灰色混進去。不是實測日照。樹仍留在場外。

畫面：`docs/art/evidence/courts/field-day.jpg`、`field-wet.jpg`。測試：`scripts/wet-surface.test.mjs`。

## 階段：綜合球場標線（ART-067 的一部分）

五虎崗綜合球場是兩塊有邊線、中線和球網的場。排球場有一圈邊線。標線都在草皮裡面。田徑場仍是跑道環，停車場仍是車格。標線尺寸仍是 estimated。雨後草皮仍把顏色乘小。樹仍留在場外。

畫面：`docs/art/evidence/courts/wuhu.jpg`。測試：`scripts/court-lines.test.mjs`。

## 階段：覺軒花園（ART-062 的一部分）

宮燈旁的覺軒花園是四根角柱和綠瓦頂，中間可以走，碰撞只在柱子。另一筆覺軒仍是坡頂。亭子周圍 6 m 不種散佈的樹。外形仍是 estimated。球場標線留著。

畫面：`docs/art/evidence/pavilion/open.jpg`。測試：`scripts/garden-pavilion.test.mjs`。

## 階段：小地圖課程字（ART-090 的一部分）

右上角小地圖在課程進行時，左下角寫兩個字：選系、移動、補給、普攻、技能。展開的校園地圖仍把這兩個字寫在金圈上方。窄視窗的課程條改到小地圖下方，系名不再被蓋住。狀態卡仍是短標籤長條。沒有新增音效。覺軒花園留著。

畫面：`docs/art/evidence/hud/minimap-desktop.jpg`、`minimap-narrow.jpg`。測試：`scripts/lesson-marker.test.mjs`。

## 階段：圖書館坡道欄杆（ART-084 的一部分）

坡道左右各一道欄杆，立柱含兩端。欄杆在現在這道 1.6 m 坡面外側，跟著坡道中線，不回到舊的南牆位置。克難坡仍不設欄杆。欄杆位置仍是 estimated。小地圖課程字留著。

畫面：`docs/art/evidence/ramp/rails.jpg`。測試：`scripts/ramp-rails.test.mjs`。

 階段：欄杆擋人（ART-084 的一部分）

圖書館坡道兩側的欄杆會擋住半徑 0.42 m 的身體。站到欄杆中線會被推開 0.48 m。坡道中線和南端外側的入口仍站得住。克難坡仍不設欄杆。位置仍是 estimated。

測試：`scripts/ramp-rails.test.mjs`。

## 階段：欄杆跟著坡（ART-084 的一部分）

圖書館坡道兩側的欄杆不再是一根水平桿。立柱站在坡面上，橫桿逐段連過去。立柱的 X 仍和 0.12 m 的碰撞同一條線。克難坡仍不設欄杆。位置仍是 estimated。

畫面：`docs/art/evidence/ramp/slope-rails.jpg`。測試：`scripts/ramp-rails.test.mjs`。

## 階段：田徑場內圈（ART-067 的一部分）

田徑場內圈不再是一整片草。中間是 24×40 m 的白線和一條中線，線留在跑道內圈裡，沒有球網。跑道環和分道留著。尺寸仍是 estimated。坡道欄杆留著。

畫面：`docs/art/evidence/track/infield.jpg`。測試：`scripts/court-lines.test.mjs`。

## 階段：車阻（ART-084 的一部分）

坡底兩根和海豚圓環十根車阻會擋住半徑 0.42 m 的身體。從西邊走向坡底西側那根會停在柱面外。圖書館巡禮從圓環東北側的缺口出去，圓環中線和三條折線仍走得過。柱位仍是 estimated。坡道欄杆和田徑場內圈留著。

畫面：`docs/art/evidence/props/bollard.jpg`。測試：`scripts/bollard-stop.test.mjs`、`scripts/route-walk.test.mjs`。

## 階段：公告牌（ART-084 的一部分）

四座公告牌的紙面寫著「校園公告」和「請沿步道行走」。字是這輪的估計用字。牌架沒有改，也沒有加碰撞。車阻留著。

畫面：`docs/art/evidence/props/notice.jpg`。測試：`scripts/notice-copy.test.mjs`。

## 階段：坡底斑馬線（ART-062 的一部分）

坡底入口鋪面上有六條斑馬線，夾在兩根門柱中間。南緣留在鋪面裡，也離坡底車阻一截。線是平塗，不擋人。間距仍是 estimated。車阻留著。

畫面：`docs/art/evidence/gates/crosswalk.jpg`。測試：`scripts/gate-crosswalk.test.mjs`。

## 階段：室內天花板（ART-080 的一部分）

公共室內共用的房間不再朝天開。天花板上緣貼著 4.4 m 的牆頂。往下看到 1.12 rad 時，鏡頭停在板底下方 0.35 m，人還在畫面裡。房間尺寸仍是遊戲裡的 20×16 m，不是實測。車阻、田徑場內圈和坡道欄杆留著。

畫面：`docs/art/evidence/interior/ceiling.jpg`。測試：`scripts/interior-ceiling.test.mjs`。

## 階段：室內南門（ART-080 的一部分）

公共室內的南門現在走得出去。開口半寬 2.5 m，對準牆的內緣。從宮燈教室開口走出去，人站回宮燈教室門外，生命和主修留著。貼著門框的位置會被牆擋住。房間仍不是實測。天花板、車阻、田徑場內圈和坡道欄杆留著。

畫面：`docs/art/evidence/interior/door-outside.jpg`。測試：`scripts/interior-door.test.mjs`。

## 階段：教育館（ART-065 的一部分）

教育館不再和會文館共用教學樓外觀。南向有雨遮，樓層有遮陽板。位置和入口仍是 estimated，不是實測立面。室內南門、天花板、車阻、田徑場內圈和坡道欄杆留著。

畫面：`docs/art/evidence/education/hall.jpg`。測試：`scripts/class-hall.test.mjs`。

## 階段：松濤二館（ART-068 的一部分）

松濤二館的南向有底層玻璃和雨遮，屋頂量體留著。其他四館仍是暖色宿舍。門面是 estimated，不是實測立面。教育館、室內南門、天花板、車阻、田徑場內圈和坡道欄杆留著。

畫面：`docs/art/evidence/sungtao/front.jpg`。測試：`scripts/dorm-front.test.mjs`。

## 階段：坡道旁的家具（ART-084 的一部分）

圖書館前靠坡的長椅改到西側，整張 1.7 m 座椅都在裙邊外。對準坡道的長花台改到坡道南端外面。其餘長椅和花台留在原排。坡度與位置仍是 estimated。松濤二館、教育館、室內南門、天花板、車阻、田徑場內圈和坡道欄杆留著。

畫面：`docs/art/evidence/ramp/furniture.jpg`。測試：`scripts/ramp-furniture.test.mjs`。

## 階段：閱讀的女孩（ART-084 的一部分）

圖書館前的銅像坐在坡道西側 x=-12 的長椅上，腳底跟長椅同一塊地面。坡道中線仍高出廣場，雕像不再坐在那裡。坡度與長椅位置仍是 estimated。靠坡的長椅和花台仍在坡面外面。

畫面：`docs/art/evidence/library/reader.jpg`。測試：`scripts/reading-girl.test.mjs`。

## 階段：機車停車場車格（ART-067 的一部分）

五虎崗機車停車場不再是一整片灰。南北兩排各 23 個車格，寬 2.4 m、深 4 m，中間走道不再畫線。貫穿中線的舊長條已拿掉。線都在鋪面裡。田徑場仍是跑道環。車格尺寸仍是 estimated。閱讀的女孩、靠坡的長椅和花台留著。

畫面：`docs/art/evidence/courts/parking.jpg`。測試：`scripts/court-lines.test.mjs`。

## 階段：球場球網（ART-067 的一部分）

五虎崗兩塊場和排球場的中線不再是一整面白牆。網是兩端的柱、上面一條帶，和中間的細直條，草皮從縫裡看得到。標線仍在草皮裡。尺寸仍是 estimated。機車格和閱讀的女孩留著。

畫面：`docs/art/evidence/courts/net.jpg`。測試：`scripts/court-lines.test.mjs`。

## 階段：未引用貼圖（ART-015 的一部分）

`public/textures` 的四張 JPG 沒有任何程式引用，卻會被打進靜態站，合計 1,199,761 bytes。目錄已移除。`dist/textures` 不再存在。材質庫仍是 `public/materials/tamkang`。meshopt 與 KTX2 仍是 planned。沒有新增音效。球場球網留著。

測試：`scripts/unused-textures.test.mjs`。

## 階段：海事博物館船首（ART-066 的一部分）

船首的四個底角蓋住船身前臉，尖端在前臉前方。四個面朝外：底面向下、頂面向上、南面 +Z、北面 -Z。船身長度仍是 estimated。未引用貼圖留著。

畫面：`docs/art/evidence/museum/bow.jpg`。測試：`scripts/ship-bow.test.mjs`。

## 下一步

見 `CHECKPOINT.json`。船首已接到前臉。未引用的四張貼圖已移出靜態站。球網已改成柱子和細帶。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。

## 階段：會文館（ART-065 的一部分）

教學區這棟不再是教學樓基座。現在是底層柱廊、淺色上層和木色壓簷。柱廊貼著南牆。教育館仍是灰基座和南向雨遮。外國語文大樓仍是底層長廊。文學館仍是坡頂。柱廊外形仍是 estimated。船首留著。

畫面：`docs/art/evidence/seminar/hall.jpg`。測試：`scripts/context-lod.test.mjs`。

## 下一步

見 `CHECKPOINT.json`。會文館已從教學樓分開。教育館、外國語文大樓與船首留著。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。

## 階段：司令臺台面（ART-067 的一部分）

司令臺的台面可以走上去。人站在台上時比周圍地面高 1.25 m，四周 3.2 m 降回地面。地面網格在台外畫出同一條坡。後方小間和兩根棚柱仍擋住。台高仍是 estimated。會文館柱廊留著。

畫面：`docs/art/evidence/stand/walk.jpg`。測試：`scripts/stand-deck.test.mjs`。

## 下一步

見 `CHECKPOINT.json`。司令臺台面已能站人。後方小間仍擋住。台高仍是 estimated。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。
## 階段：路人畫質（ART-033 的一部分）

高畫質路人用角色組，140 m 外不繪製。低畫質改用程序學生，90 m 外不繪製，不載入 npc-kit。宮燈大道低畫質仍看得到走路的學生。游泳館留著。

畫面：`docs/art/evidence/npc/low.jpg`。測試：`scripts/npc-lod.test.mjs`。

## 下一步

見 `CHECKPOINT.json`。低畫質路人已改用程序學生。游泳館與課程標記留著。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。

## 階段：傳輸預算（ART-015）

七個遊戲美術 GLB 的 gzip 合計 1.70 MB。最大是 npc-kit，607,919 bytes。決定先不加 meshopt 或 KTX2。測試把每個檔的 raw 與 gzip 上限定住。真機傳輸仍是 pending-device。行政大樓留著。

測試：`scripts/art-budget.test.mjs`。

## 下一步

見 `CHECKPOINT.json`。傳輸預算已量過，meshopt 與 KTX2 先留著。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。

## 階段：宮燈大道四時段（ART-086）

同一站點 (0, -80) 留下晴天、夕照、夜、雨後。晴天路燈滅，夕照與夜路燈亮，雨後鋪面變濕。不是實測日照。行政大樓仍是石色樓身。

畫面：`docs/art/evidence/lighting/`。測試：`scripts/lighting-times.test.mjs`。

## 下一步

見 `CHECKPOINT.json`。四時段截圖已留下。行政大樓已從教學樓分開。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。

## 階段：宮燈教室轉角鏡頭（KI-18）

西廳轉角的跟隨鏡頭留在視線上。舊的推出會甩開 2.6 m。水平距離不夠 2.2 m 就升高，人仍在畫面裡。迴廊外側直走仍保持約 5 m。實棟學人宿舍仍是淺色樓身和南向門廊。

畫面：`docs/art/evidence/colonnade/corner.jpg`。測試：`scripts/physics-clock.test.mjs`。

## 下一步

見 `CHECKPOINT.json`。轉角鏡頭已留在視線上。實棟學人宿舍已從學生宿舍分開。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。

## 階段：廣場路燈（ART-084 的一部分）

路燈頭跟著宮燈用的同一個 `lampsOn`。晴天燈頭不亮，夜裡燈頭亮。燈頭位置取自模型比例，不是實測燈具。外國語文大樓仍是底層長廊和南向退縮的上層。

畫面：`docs/art/evidence/lamps/day.jpg`、`night.jpg`。測試：`scripts/street-lamp.test.mjs`。

## 下一步

見 `CHECKPOINT.json`。路燈頭已跟著夜裡點亮。外國語文大樓已從教學樓分開。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。

## 階段：路燈燈柱（ART-084 的一部分）

五十九根路燈的燈柱會擋住半徑 0.42 m 的身體。從西邊走向克難坡西側那根會停在柱面外。13 m/s 的閃避拆成 0.2 m 的小步，不會穿到柱子另一側。三條巡禮在廣場北側先回到中線，圖書館這條從海豚到書卷時走路燈東側。燈位仍是 estimated。田徑場內圈留著。

畫面：`docs/art/evidence/props/lamp.jpg`。測試：`scripts/lamp-stop.test.mjs`、`scripts/route-walk.test.mjs`。

## 階段：樹幹（ART-085 的一部分）

校區裡點名的 134 棵樹，樹幹會擋住半徑 0.42 m 的身體。從西邊走向坡底那棵榕樹會停在樹幹外。80 ms、13 m/s 的閃避拆成 0.2 m 的小步，不會穿到樹幹另一側。灌木和地面植物沒有樹幹。巡禮折線和估計路網仍走得過。樹位仍是 estimated。遠景散佈的樹仍可走過去。路燈燈柱留著。

畫面：`docs/art/evidence/planting/trunk.jpg`。測試：`scripts/tree-stop.test.mjs`、`scripts/route-walk.test.mjs`、`scripts/campus-links.test.mjs`。

## 階段：校門門柱（ART-062 的一部分）

水源街校門的兩根門柱會擋住半徑 0.42 m 的身體。從西邊走向西側那根會停在柱面外。門洞中線和頭頂的橫梁仍走得過。80 ms 的閃避拆成 0.2 m 的小步，不會穿到柱子另一側。門位仍是 estimated。樹幹留著。

畫面：`docs/art/evidence/gates/campus-arch.jpg`。測試：`scripts/gate-pier.test.mjs`。

## 階段：帶字路牌（ART-062 的一部分）

克難坡、宮燈大道和圖書館指引這五塊路牌會擋住半徑 0.42 m 的身體。從西邊走向坡底「克難坡」那塊會停在牌面外。巡禮折線仍走得過。80 ms 的閃避拆成 0.2 m 的小步，不會穿到牌子另一側。牌位仍是 estimated。校門門柱留著。

畫面：`docs/art/evidence/signs/kenan-board.jpg`。測試：`scripts/text-sign.test.mjs`。

## 階段：圖書館台基（ART-063 的一部分）

圖書館台基比牆面每邊多出 2.5 m，高 1.1 m，會擋住半徑 0.42 m 的身體。從南邊走向台基南緣會停在邊緣外。坡道中線從缺口走上去。尺寸仍是 estimated。帶字路牌留著。

畫面：`docs/art/evidence/library/plinth.jpg`。測試：`scripts/library-plinth.test.mjs`。

## 階段：減少動態時風停（ART-087 的一部分）

系統要求減少動態時，樹冠、灌木和草的風力收到 0，時鐘也不再走。恢復一般動態後，白天風力回到 1。雨絲原本就會停。沒有新增音效。圖書館台基留著。

畫面：`docs/art/evidence/motion/still-avenue.jpg`。測試：`scripts/wind-motion.test.mjs`。

## 階段：減少動態時河與雲停（ART-087 的一部分）

系統要求減少動態時，河面波紋的時鐘停住，雲場也不再漂移。天色仍會跟著時段變。沒有新增音效。樹和草的風停留著。

畫面：`docs/art/evidence/motion/still-shore.jpg`。測試：`scripts/scenery-motion.test.mjs`。

## 階段：減少動態時標題鏡頭停（ART-087 的一部分）

系統要求減少動態時，標題鏡頭停在軌道中心，不再繞著驚聲廣場飄。一般動態仍會慢慢繞。沒有新增音效。河面和雲的停停留著。

畫面：`docs/art/evidence/motion/still-title.jpg`。測試：`scripts/title-camera.test.mjs`。

## 階段：吊飾停住（ART-020 的一部分）

減少動態時，髮尾和小龜吊飾的彈簧目標是 0。從偏離的姿勢經過阻尼後會回到原位。普通移動仍會讓吊飾跟著身體速度擺。走路、攻擊那些片段仍由真實事件播放。沒有新增音效。標題鏡頭留著。

畫面：`docs/art/evidence/charm/backpack.jpg`。測試：`scripts/still-charm.test.mjs`。

## 階段：牧羊草坪雕塑（ART-063 的一部分）

牧羊草坪放了一座「唱自己的歌」的立姿剪影，站在 1.6 m 石座上。石座會擋住半徑 0.42 m 的身體。蓋章點在石座南邊，沒有被推進碰撞。巡禮折線不經過石座。外形與位置仍是 estimated。五虎碑還沒有放到場景裡。吊飾停住留著。

畫面：`docs/art/evidence/meadow/figure.jpg`。測試：`scripts/shepherd-figure.test.mjs`。

## 階段：五虎碑（ART-067 的一部分）

紹謨紀念體育館北側放了一座五虎碑。石座直徑 3.2 m，中央石碑朝北，五隻伏姿銅雕環在座上。石座會擋住半徑 0.42 m 的身體，而且不跨過館牆。蓋章點在石座北邊的草地上。巡禮折線不經過石座。外形與位置仍是 estimated。牧羊草坪的立姿留著。

畫面：`docs/art/evidence/tigers/stele.jpg`。測試：`scripts/tiger-stele.test.mjs`。

## 階段：舷側展示機（ART-066 的一部分）

海事博物館北側停了一架戰鬥機和一架直升機，平行於船身。機身連機翼會擋住半徑 0.42 m 的身體。南門留在館外。旋翼不轉。外形與位置仍是 estimated。五虎碑和牧羊草坪的立姿留著。

畫面：`docs/art/evidence/exhibits/jet.jpg`、`heli.jpg`。測試：`scripts/museum-exhibits.test.mjs`。

## 階段：籃架底座（ART-082 的一部分）

體育館的兩座籃架各有一塊 1.4 m 的底座，會擋住半徑 0.42 m 的身體。從底座中心會被推開。往東跨 1.04 m 仍停在中心西側。教室裡同一點不會被這座底座推開。南門仍站得住。房間仍不是實測。展示機留著。

畫面：`docs/art/evidence/hoop/stand.jpg`。測試：`scripts/hoop-base.test.mjs`。

## 階段：教室講台（ART-080 的一部分）

宮燈教室黑板前有一張 1.6×1.3 m 的講台，會擋住半徑 0.42 m 的身體。從南緣往北跨 1.04 m 仍停在講台中心南側。閱讀室同一點不會被推開。南門仍站得住。講台不和學生桌重疊。房間仍不是實測。籃架底座留著。

畫面：`docs/art/evidence/desk/front.jpg`。測試：`scripts/class-desk.test.mjs`。

## 階段：閱覽桌（ART-081 的一部分）

閱讀室北牆有兩座 1.4×1.3 m 的閱覽桌，後面有擋板，會擋住半徑 0.42 m 的身體。中間走道留著。教室同一點不會被推開。南門仍站得住。從南緣往北跨 1.04 m 仍停在中心南側。推出方向若會出房間就改走另一軸。房間仍不是實測。講台留著。

畫面：`docs/art/evidence/carrel/east.jpg`。測試：`scripts/reading-carrel.test.mjs`。

## 階段：書架讓位（ART-081 的一部分）

閱讀室的層板內緣在 9.06，書本內緣在 9.18，都在身體最外緣 9 和牆內面 9.45 之間。人站在房間側邊不會穿進書架。閱覽桌留著。尺寸仍是 estimated。

畫面：`docs/art/evidence/shelves/east.jpg`。測試：`scripts/shelf-clear.test.mjs`。

## 階段：前庭石座（ART-063 的一部分）

閱讀的女孩坐在圖書館前庭西側 1.4 m 石座上，會擋住半徑 0.42 m 的身體。石座不在坡道上。坡道中線仍走得過。低畫質也看得到她。書架留著。位置仍是 estimated。

畫面：`docs/art/evidence/girl/south.jpg`。測試：`scripts/reading-girl.test.mjs`。

## 階段：體育館夜窗（ART-067 的一部分）

紹謨紀念體育館南面高側窗在路燈亮時發暖光，顏色和大道夜燈相同。白天不發光。窗位仍是 estimated。前庭石座留著。

畫面：`docs/art/evidence/gym-night/south.jpg`。測試：`scripts/gym-glow.test.mjs`。

## 階段：書卷四字（ART-063 的一部分）

書卷廣場四片書卷朝中心的一面各寫樸、實、剛、毅一字。字牌在既有 3 m 碰撞盒裡面，高度約 3.7 m。沒有新增碰撞。字位仍是 estimated。體育館夜窗留著。

畫面：`docs/art/evidence/scroll-words/southeast.jpg`。測試：`scripts/scroll-words.test.mjs`。

## 階段：海豚勉詞（ART-062 的一部分）

海豚里程碑基座南面寫兩行：立足淡江，放眼世界；掌握資訊，開創未來。牌子高 0.72 m，仍在既有石座上。沒有新增碰撞。字位仍是 estimated。書卷四字留著。

畫面：`docs/art/evidence/dolphin-motto/south.jpg`。測試：`scripts/dolphin-motto.test.mjs`。

## 階段：游泳館夜窗（ART-067 的一部分）

紹謨紀念游泳館的南向高窗在路燈亮起時發冷水色。白天仍是原來的玻璃色，強度是 0。館身、基座和屋頂長脊留著。體育館的暖色高窗留著。水道長度仍待測。外形仍是 estimated。海豚勉詞留著。

畫面：`docs/art/evidence/pool/night.jpg`。測試：`scripts/pool-glow.test.mjs`。

## 階段：活動室球場（ART-067 的一部分）

紹謨紀念體育館室內只留一組標線：邊線、底線、中線、中圈和兩側禁區。舊的牆邊 x=±8.5、z=±5.5 那組已拿掉。底線在籃框與籃架之間。標線貼在木地板上，不擋人。籃架底座仍會擋人。宮燈教室和閱讀室沒有這些線。尺寸仍是 estimated。游泳館夜窗留著。

畫面：`docs/art/evidence/gym/court.jpg`。測試：`scripts/activity-court.test.mjs`。

## 階段：游泳館水道（ART-067 的一部分）

紹謨紀念游泳館室內是水面、分道線和西端出發台。進門和讀檔站在南邊甲板 z=5.2。人走到池邊會停在水面外。出發台低於踏階，不另設碰撞。體育館仍是籃架、中圈和一組地板標線。水道長度仍待測。外形仍是 estimated。活動室標線留著。

畫面：`docs/art/evidence/pool/lanes.jpg`。測試：`scripts/pool-water.test.mjs`。

## 階段：黑天鵝（ART-066 的一部分）

海事博物館室內北牆是一座黑天鵝剪影和寫著黑天鵝的台座。人走到台座會停在外面，也留在房間裡。閱讀室沒有這座台座。船型外觀留著。外形仍是 estimated。車阻留著。

畫面：`docs/art/evidence/museum/swan.jpg`。測試：`scripts/swan-exhibit.test.mjs`。

## 階段：終點線（ART-067 的一部分）

田徑場南直道有一條白色終點線，從內緣拉到外緣，橫過分道。線在跑道帶上，不進內圈草地。沒有球網，也不擋人。內圈仍是 24×40 m。線寬仍是 estimated。車阻留著。

畫面：`docs/art/evidence/track/finish.jpg`。測試：`scripts/court-lines.test.mjs`。

## 階段：沙坑（ART-067 的一部分）

田徑場內圈東側的草地上有一座 3×8 m 的沙坑和西端起跳板。沙坑在跑道內緣裡面，也不壓到 24×40 m 的白線。沙面可以走過去。尺寸仍是 estimated。車阻留著。

畫面：`docs/art/evidence/track/pit.jpg`。測試：`scripts/court-lines.test.mjs`。

## 階段：商管大樓（ART-065 的一部分）

商管大樓不再用教學樓基座。深色玻璃底座托著退縮的淺色樓身。行政大樓仍是窄入口。外形是 estimated，不是實測立面。

畫面：`docs/art/evidence/business/tower.jpg`。測試：`scripts/business-hall.test.mjs`。

## 階段：文學館（ART-065 的一部分）

文學館不再和覺軒共用尖坡頂。樓身是淺色，南向有寬窗，屋頂是一圈綠瓦平簷。外形是 estimated，不是實測立面。

畫面：`docs/art/evidence/humanities/hall.jpg`。測試：`scripts/lit-hall.test.mjs`。

## 階段：松濤陽台（ART-068 的一部分）

松濤一、三、四、五館的南向，地面層以上每一層有一條陽台。松濤二館仍是底層玻璃和雨遮，上層也有同一條陽台。麗澤和實棟不共用這條陽台。位置仍是 estimated。

畫面：`docs/art/evidence/sungtao/balcony.jpg`。測試：`scripts/dorm-balcony.test.mjs`。

## 階段：覺軒（ART-062 的一部分）

覺軒不再用共用的扁錐坡頂。南向有迴廊，坡頂較高也比較收。文學館仍是綠瓦平簷。外形是 estimated，不是實測立面。

畫面：`docs/art/evidence/chueh/veranda.jpg`。測試：`scripts/chueh-veranda.test.mjs`。

## 階段：海事博物館裙牆（ART-066 的一部分）

海事博物館的船身仍放在基地中心，並偏了 0.16 rad。裙牆跟著船身轉，西南角落留在裙牆裡面。南邊入口沒有被裙牆擋住。東邊較高的坡仍會埋進船身下緣。裙牆是 estimated。

畫面：`docs/art/evidence/museum/skirt.jpg`。測試：`scripts/museum-skirt.test.mjs`。

## 階段：體育館裙牆（ART-067 的一部分）

紹謨紀念體育館的館身仍放在基地中心。西北角低處，樓底有一條裙牆接到地面。南邊入口沒有被裙牆擋住。東邊較高的坡仍會埋進館身下緣。裙牆是 estimated。

畫面：`docs/art/evidence/gym/skirt.jpg`。測試：`scripts/gym-skirt.test.mjs`。

## 階段：外語大樓裙牆（ART-065 的一部分）

外國語文大樓的樓身仍放在基地中心，沒有偏角。西南角低處，樓底有一條裙牆接到地面。南邊入口沒有被裙牆擋住。東邊較高的坡仍會埋進樓身下緣。裙牆是 estimated。

畫面：`docs/art/evidence/language/skirt.jpg`。測試：`scripts/foreign-skirt.test.mjs`。

## 階段：活動中心裙牆（ART-066 的一部分）

學生活動中心的樓身仍放在基地中心，沒有偏角。西北角低處，樓底有一條裙牆接到地面。南邊入口沒有被裙牆擋住。東邊較高的坡仍會埋進樓身下緣。裙牆是 estimated。

畫面：`docs/art/evidence/activity/skirt.jpg`。測試：`scripts/commons-skirt.test.mjs`。

## 階段：迴廊柱（ART-062 的一部分）

宮燈教室迴廊的紅柱現在有碰撞。柱心會把人推開，兩根柱中間仍走得過，大道中線也不受影響。柱距仍是 estimated。

畫面：`docs/art/evidence/palace/column.jpg`。測試：`scripts/column-stop.test.mjs`。

## 階段：圖書館雨遮柱（ART-084 的一部分）

圖書館南向雨遮的兩根柱子會擋住半徑 0.42 m 的身體。兩柱中間和圖書館門口仍站得住。柱位仍是 estimated。宮燈迴廊柱留著。

畫面：`docs/art/evidence/library/porch-post.jpg`。測試：`scripts/library-posts.test.mjs`。

## 階段：旗杆石座（ART-084 的一部分）

驚聲銅像廣場西側的旗杆石座會擋住半徑 0.42 m 的身體。銅像前、石座東側和巡禮中線仍走得過。石座位置仍是 estimated。圖書館雨遮柱留著。

畫面：`docs/art/evidence/plaza/flagpole.jpg`。測試：`scripts/flag-base.test.mjs`。

## 階段：宮燈燈座（ART-084 的一部分）

宮燈大道兩側的石燈座會擋住半徑 0.42 m 的身體。6 m 鋪面和兩燈之間仍走得過。杜鵑改種在燈座外側。到宮燈教室的折線先回到大道中線。到圖書館的折線沿中線走到最後一盞燈南側，再從東側繞過燈座和海豚圓環的南車阻。大道上的三場遭遇往外站到燈座外側。燈位仍是 estimated。旗杆石座留著。

畫面：`docs/art/evidence/avenue/lantern.jpg`。測試：`scripts/lantern-stop.test.mjs`。

## 階段：書卷矮牆（ART-084 的一部分）

書卷廣場西側的矮牆會擋住半徑 0.42 m 的身體。廣場中心、牆端外側和三條巡禮折線仍走得過。牆位仍是 estimated。宮燈燈座留著。

畫面：`docs/art/evidence/scroll/wall.jpg`。測試：`scripts/scroll-wall.test.mjs`。

## 階段：公告牌（ART-084 的一部分）

坡底、書卷廣場、東側和西側的四塊公告牌會擋住半徑 0.42 m 的身體。公告牌旁邊和三條巡禮折線仍走得過。牌位仍是 estimated。書卷矮牆留著。

畫面：`docs/art/evidence/props/noticeboard.jpg`。測試：`scripts/notice-stop.test.mjs`。

## 下一步
見 `CHECKPOINT.json`。公告牌已會擋人。書卷矮牆已會擋人。宮燈燈座已會擋人。旗杆石座已會擋人。圖書館雨遮柱已會擋人。迴廊柱已會擋人。活動中心西北邊樓底已接到坡上。外語大樓西南邊樓底已接到坡上。體育館西北邊樓底已接到坡上。海事博物館的裙牆已跟著船身轉。覺軒已有南向迴廊。松濤宿舍已有南向陽台。文學館已有綠瓦平簷。商管大樓已有深色玻璃底座和退縮的樓身。四座公告牌已寫著校園公告、請沿步道行走。坡底入口已有六條斑馬線。田徑場內圈東側已有一座可走的沙坑。田徑場南直道已有終點線。海事博物館室內已有會擋人的黑天鵝台座。游泳館室內已有會擋人的水面。活動室地板只留一組標線。手機與 RTX 3060 仍是 pending-device。不要加入沒有授權的音效。
