# 共同契約

整合代理維護對照。本輪只有美術線提交了新契約；後端與內容線尚未提供檔案。下面「現行」是 `main` @ `71f4d3c` 加上美術 M1 後，程式裡真正在用的介面。

## 誰提供什麼

| 契約 | 提供線 | 本輪版本 | 位置 |
| --- | --- | --- | --- |
| API | 後端 | 雲端信封 `schemaVersion` 1，已在 `main` | `docs/backend/API.md` |
| 內容 schema | 內容 | 敘事 manifest `revision` 1。沒有 `schemaVersion`。效果白名單在 `src/features/narrative/schema.ts` | `content/narrative/`、`docs/content/` |
| 資產 manifest | 美術 | `schemaVersion` 1 | `art/assets.json` → `public/game-art/manifest.json` |

## 資產

| id | 用途 | 載入 | 失敗時 |
| --- | --- | --- | --- |
| `char.student-kit` | 高畫質主角 | `Protagonist` | `ArtBoundary` 改回 `Student`，並通知一次 |
| `char.student-kit-lod1` | 省電主角。同骨架、同動畫 | 低畫質 | 同上 |
| `creature.quiz` | `kind === "quiz"` | `CreatureActor` | 改回 `LegacyMonster` |
| `creature.report` | `kind === "report"` | `CreatureActor` | 同上 |
| `creature.exam` | `kind === "exam"` | `CreatureActor` | 同上 |
| `creature.final` | `kind === "final"` | `CreatureActor` | 同上 |
| `char.npc-kit` | 五條既有路徑上的 NPC | `NpcCharacter` | 改回程序 `Student` |

URL 帶內容雜湊。幾何與 atlas 共享。卸載只走 `releaseArtInstance`：釋放複製材質與骨架 bone texture，不釋放共享幾何。

九學院技能都有專屬外形，讀既有 `attackFx`。工程「結構脈衝」仍是 `StructuralPulse`。其餘八個學院在 `CollegeCasts`。施放時不畫普攻光刃。

動畫與特效只讀 `attackFx`、`hurtUntil`、敵人 `state`／`timer`／`hurt`／`hp`。不寫回戰鬥。

## 戰鬥與科系

現場科系表是 `src/game/rpg/data.ts` 的 `DEPARTMENTS`。id 形如 `` `${discipline}-${college}-${index}` ``。土木工程學系是工學院第二筆，discipline 為 `engineering`。

`engineering` 的技能名稱是「結構脈衝」（傷害 40、範圍 12、冷卻 6）。`StructuralPulse` 讀 `attackFx`：範圍用 `attackFx.range`，命中對象用 `attackFx.hits`。其他學院的施放也讀 `attackFx`，各自畫 `CollegeCasts`。商管金幣只有一個命中點時，終點沿圓周散開，不疊在同一點。普攻光刃在 `src/game/art/vfx/basic-swing.ts`，跟著 0.46 秒攻擊片段從角色右側移到左側，蓄力幀在身前，長度約前臂，不跟著 `attackFx.range` 放大。

`char.student-kit` 的每個動作片段取 17 個時間點，比較背包正面的蒙皮頂點和同一高度的外套背面。揹帶仍綁在胸口，不計入這段間隙。最靠近的是 run，間隙 22.0 mm。背包骨轉 90 度會穿進外套 116.7 mm，測試會失敗。靜止姿勢的外套環檢查仍在。這不是第二套角色。

敵人 id 與種類（`src/game/rpg/data.ts`）：`quiz-1`…`quiz-4`、`report-1`、`report-2`、`exam-1`、`exam-2`、`final-1`。判定半徑仍是 `ENEMY_TYPES[kind].radius + 2.5`。預警圈用這個半徑。

委託面板的 `claim(id)` 只結 `MISSIONS`。同一個 `claimed` 陣列也收校園事件的 `quest-*` id。校園獎勵走 `grantQuestReward`，不另開背包。學期故事裡還有另一個同名函式，兩本帳沒有合併。

狀態卡可見文字來自 `BarReadout.short`（`src/game/rpg/status.ts`），形如「生命 62/108」。小數最多一位。長句 `line`（目前值、最大值、變化）只放在計量條的 `aria-label`。填色是生命 `#e09a8c`、專注 `#8eb8b4`、經驗 `#ddc691`，軌道 `#cfc6b0`，字色沿用 `--ad-ink`。提示畫在長條外面，窄卡用 `flex-wrap` 換行。窄於 700px 時 `.ad-target` 的 `top` 是 268px。快捷欄技能圖示讀 `SKILL_GLYPH`，一個學院一個 lucide 名稱，工程是 `DraftingCompass`。沒有第二份技能表。受擊邊緣是 `.ad-hurt` 的 `inset 0 0 72px 18px #b04c4799`。校園地圖的建物描邊讀 `zoneMark`，顏色來自既有清冊分區，圖例七個名稱是軸線、書圖、理工、教學、文藝、運動、生活。分區框會重疊，玩家所在區用 `zoneNear` 找最近的建物，不把框線當成實測界。展開的校園地圖在課程金圈上方寫兩個字：選系、移動、補給、普攻、技能。完成與沒有課程時不寫字。小地圖仍只畫金圈。

敘事預覽的 `quest-reward` 呼叫既有 `grantQuestReward`。非法效果（`set-hp`、`add-item`、`eval`、`script`、`mutate-save`）整段取消。預覽把結果寫在 `tk-narrative-preview-fixture-v1`。

校園進入點用同一條白名單。差額寫回主存檔的經驗、筆記、學分與 `claimed`。事件旗標、任務節點與已解決事件放在同一份存檔的 `narrative`，不是第二份生命或背包。內容套件的 `MAIN_INTEGRATION` 常數仍是 false。

## 地點

`permanentId` 與 `aliasOf` 在 `src/game/world-data/registry/index.ts` 的 `RegistryEntry`。清冊筆數沒有增刪，精度仍全部 `estimated`。

科學館的顯示名稱是「騮先紀念科學館」，泳館是「紹謨紀念游泳館」。兩筆的 `permanentId` 仍是 `science` 與 `swimming`，存檔 id 沒有改。座標仍是 estimated，`fieldChecked` 仍是 false。

校園門口的可見步道由 `entranceRoadPath` 從門口走到估計路網上能站的點。不再對準最近的一條垂直線。這不是實測路線，也沒有新的階數。

三條巡禮折線以半徑 0.42 m 從驚聲銅像東側走到宮燈教室、圖書館、體育館門口。體育館從宮燈教室南緣，再從學生活動中心與教育館之間通過。克難坡中線從坡底走到坡頂，人留在護牆之間。階數沒有展開。座標仍是 estimated。估計路網在視聽教育館北牆外改走 z=-25.6，範圍是 x 202 到 242。大忠警衛站的路改從 x=486 的兩根門柱中間過。這兩段位置仍是 estimated。

`form === "gate"` 的建築（大門警衛站、大忠警衛站）畫成兩根門柱加橫樑。`gatePiers` 的門柱寬是 1.5。碰撞只加在門柱上，開口中心可以站。這是估計外形，不是實測門寬。

白樓的種類是 `white-block`。`theme === "arts"` 是 `hip-roof-block`，宿舍是 `dorm-block`，實驗樓是 `lab-block`，運動館是 `sport-hall`，教學樓是 `study-block`。清冊裡沿用的商管大樓 `business-building` 也是 `study-block`：深色基座、淺色上層、近處橫樑。書圖區的 `integrated` 是 `linked-hall`：玻璃基座用整棟底面積，上層退縮，上層窗帶跟 `linkedHallProfile` 的牆面，不再用整棟的寬。圖書館仍用既有量體。沿用的 `chingsheng-building` 是 `memorial-tower`：深色基座、石色樓身、底層玻璃、平頂壓簷，不畫共用窗帶，也沒有綠瓦。文學館仍是 `hip-roof-block`。樓身外形仍是 estimated。文藝區的 `conference` 是 `forum-hall`：低寬淺色量體、南向玻璃帶、出挑屋簷，不畫共用窗帶。海事博物館仍是船型。運動區的 `reviewing` 是 `stand`：低平台、後方小間、棚頂，不畫共用窗帶，也不畫實驗樓屋頂設備。台面還不能走上去。理工區的 `wind-lab` 是 `shed`：低長廠房、屋頂風管、一端進氣箱，不畫共用窗帶。化學館仍是 `lab-block`。理工區的 `architecture` 是 `studio-block`：混凝土量體、南向玻璃、遮陽板、屋頂採光，不畫共用窗帶。主題仍是 `arts`，id 覆寫留在主題判斷前面，所以不再戴綠瓦。工作室外形仍是 estimated。生活區的 `reitaku` 是 `intl-dorm`：淺灰綠牆、底層玻璃門廳、平頂橫樑。松濤仍是暖色 `dorm-block`。麗澤仍畫共用窗帶。生活區的 `faculty` 是 `faculty-house`：淺色樓身、南向門廊、兩條窗帶，不畫共用窗帶，也沒有宿舍屋頂量體。主題仍是 `dorm`，id 覆寫留在主題判斷前面。松濤一館到五館仍是 `dorm-block`。麗澤仍是 `intl-dorm`。門廊外形仍是 estimated。教學區的 `business-o` 與 `business-q` 是 `media-hall`：深色基座、淺色上層、屋頂天線。文學館仍是 `hip-roof-block`。傳播館仍畫共用窗帶。天線不是實測。文藝區的 `audiovisual` 是 `auditorium`：深色廳堂、屋頂一端舞台塔。共用窗帶仍畫。舞台塔不是實測。文藝區的 `commons` 是 `activity-hall`：一層門廳、南向玻璃、遮陽板、退縮上層，不畫共用窗帶。主題仍是 `arts`，id 覆寫留在主題判斷前面。分區仍是 culture-58。覺軒仍是 `hip-roof-block`。門廳外形仍是 estimated。文藝區的 `yingyuan` 是 `garden-house`：白牆、木色基座、收緊的綠瓦坡頂、南向迴廊，不畫共用窗帶。白牆從基座頂接到坡頂底。主題仍是 `arts`，id 覆寫留在主題判斷前面。文學館與覺軒仍是 `hip-roof-block`。迴廊與坡頂外形仍是 estimated。軸線上的 `security` 是 `watch-post`：低崗亭、南向窗、屋頂天線，不畫共用窗帶，也不畫實驗樓屋頂設備。主題仍是 `lab`，id 覆寫留在主題判斷前面。化學館仍是 `lab-block`。大門仍是 `gate`。崗亭外形仍是 estimated。理工區的 `engineering` 是 `eng-tower`：深色基座、退縮的淺色塔樓、兩條窗帶貼在退縮面上，不畫共用窗帶，也不畫實驗樓屋頂設備。主題仍是 `lab`，id 覆寫留在主題判斷前面。化學館仍是 `lab-block`。塔樓外形仍是 estimated。沿用的 `gymnasium` 是 `arena`：淺色館身、深色台基、南向高側窗、出挑平頂，不畫共用窗帶。司令臺仍是 `stand`。館身外形仍是 estimated。運動區的 `swimming` 是 `pool-hall`：深色基座、淺色長廳、南向高窗、屋頂長脊，不畫共用窗帶。主題仍是 `sport`，id 覆寫留在主題判斷前面。體育館仍是 `arena`。水道長度仍待測。館身外形仍是 estimated。文藝區的 `administration` 是 `office-block`：石色樓身、深色基座、南向入口玻璃、兩條窗帶，不畫共用窗帶。主題仍是 `study`，id 覆寫留在主題判斷前面。教育館與會文館仍是 `study-block`。舊的 admin-hall 不合併。入口位置仍待測。外形仍是 estimated。教學區的 `foreign` 是 `language-hall`：暖色底層、南向長廊玻璃、退縮的淺色上層，不畫共用窗帶。上層窗帶貼著退縮的牆。主題仍是 `study`，id 覆寫留在主題判斷前面。舊的 foreign-lang-hall 不合併。長廊外形仍是 estimated。理工區的 `science` 是 `science-hall`：淺色館身、東側直玻璃、壓簷，不畫共用窗帶，也沒有實驗樓屋頂設備。主題仍是 `lab`，id 覆寫留在主題判斷前面。化學館仍是 `lab-block`。未匯出的舊剪影 `science-hall` 沒有畫進場景。館身外形仍是 estimated。理工區的 `old-engineering` 是 `workshop`：磚紅基座、淺色上層、南向玻璃、屋頂小間，不畫共用窗帶，也沒有實驗樓屋頂設備。主題仍是 `lab`，id 覆寫留在主題判斷前面。工學大樓仍是 `eng-tower`。化學館仍是 `lab-block`。館身外形仍是 estimated。精度仍是 estimated。`form === "gate"` 仍是 `gate`，不因教學樓量體改回方塊。窗帶、名牌、坡頂、宿舍退縮層、實驗樓屋頂設備和教學樓橫樑由 `contextShowsDetail` 決定。高畫質 90 m 內才畫，省電是 48 m。量體一直留著。精度仍是 estimated。

高畫質的詳細樹冠半徑是 `vegetationRange` 48。樹木與灌木再遠換成便宜樹冠。杜鵑、花圃、地被和青苔超出這個距離就不畫。棕櫚超出距離留便宜樹冠。正好 48 m 算遠景。省電畫質本來就用 `simpleTrees`，70 m 是便宜樹冠的距離，不是第二個細模半徑。植株位置仍是 estimated。

學期只看既有 `claimed`，不看電腦日期，也不另開獎勵帳。大門任務 `quest-orient-gate` 和補給委託 `quest-errand-campus-post` 都領取後是期中；再加上既有戰鬥任務 `first` 才是期末；否則是第一週。委託付經驗 12、筆記 2，只進既有背包，而且只記一次。合法放置結算同一次。兩份科系清冊都留著。查詢把「化學系／化學學系」「數學系／應用數學與數據科學學系」當別名。存檔仍用 RPG id，鍵仍是 `tamkang-rpg-v2`。`MAIN_INTEGRATION` 仍是 false。

裝備、製作和臨時設施也走這只背包。主工具、配件、背包各一槽，格子仍是 24。徽章仍走原來的裝備，不加第二次生命。材料不足或數量不對就不扣。拆除與退還仍是一半，向下取整。負重、燈和採集加成寫在同一份 `tamkang-rpg-v2` 的 `loadout` 與 `gear`，不另開存檔。

同一條高畫質路線在遊戲程式 `7507c59` 的靜態頁重測：標題 1,204,683、戶外 1,562,527、戰鬥 1,495,745、返回 1,437,689，都低於 1.6 M。室內 46,548。幀時間是這台 SwiftShader，不是手機或 RTX 3060。手機圖示只改 CSS，沒有重測三角形。

窄於 700px 時右上 `.ad-icon` 是 44×44，快捷欄 svg 是 24×24。觸控且窄於 700px 的快捷鈕是 44px。更寬的畫面仍用 42×42 的工具鈕。技能圖示仍讀 `SKILL_GLYPH`，沒有第二份技能表。

雨只在光照預設 `wet`、人在戶外時畫。`rainStreaks` 高畫質是 320、低畫質是 64。減少動態時雨絲停住，而且讀的是會跟著系統設定更新的 `useReducedArtMotion`。室內不畫。這不是第二套天氣表。

淡水遠景的近岸是 `SHORE_X`（-112）。人走到河上會被這道碰撞推回岸邊。存在水裡的位置，包含地圖南北兩端，也回到 `SHORE_X` 加上角色半徑的這一側，不會再被世界邊界推回河面。對岸街廓與山脊都在這條線以西，只是剪影，不是實測河寬或山形。金幣散開與蓄力刃沒有改這條岸線。

驚聲廣場的環形樹避開標題鏡頭 `TITLE_ORBIT`（-13, 13）16 m。杜鵑花環沒有跟著退。這是為了標題畫面，不是實測植栽位置。

室內路線用既有 `enter("palace")`／`exit()`。宮燈教室 id 是 `palace`。

## 存檔

兩把本地鍵，本輪都沒有改格式：

| 鍵 | 版本欄 | 內容 |
| --- | --- | --- |
| `tamkang-world-v1` | `version: 2`（`SAVE_VERSION`） | 巡禮造訪、光影、音量、畫質、舊背包與科系 |
| `tamkang-rpg-v2` | `snapshot().version === 2` | 生命、專注、任務 `claimed`、建築、背包槽、裝備 `loadout` 與 `gear`、位置、室內，以及同一份存檔上的 `narrative` 事件記憶 |

寫入是延遲 1.8 秒的本地 `localStorage`。另一個分頁寫入同一鍵時，`onForeignSave` 只把文字放進 `foreignText` 並把 `saveConflict` 設為 true，不直接覆蓋目前進度。玩家再選接受本機或接受外來。這是分頁衝突，不是雲端同步。

靜態建置不要求伺服器，也不含雲端面板、`/api/cloud` 或敘事預覽頁。雲端信封的 `contentVersion: 2` 是這份 RPG 存檔的 `version`，不是敘事 manifest 的 `revision: 1`。`?qa=1` 才掛上 `window.__rpgQA`，正式遊玩不讀它。

## 尚未統一、本輪不刪的兩份科系表

`src/game/departments.ts` 使用 `civil`、`cs` 這類 id。`src/game/rpg/data.ts` 使用 `engineering-工學院-N`。匯入舊檔時 `legacyDepartment` 會試著對名稱。兩份表都還有呼叫端。內容線給出唯一清冊之前，不刪其中一份，也不另做第三份。見 `KNOWN-ISSUES.md` 的 INT-01。
