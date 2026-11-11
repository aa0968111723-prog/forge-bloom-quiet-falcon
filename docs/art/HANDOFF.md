# 交接

最後更新：2026-11-11。學生活動中心改成門廳、南向玻璃、遮陽板和退縮上層。覺軒仍是坡頂。建築系館留著。精度仍是 estimated。整體目標尚未完成。
恢復工作時先讀 `CHECKPOINT.json` 的 `next_action`，再看 `BACKLOG.json` 的依賴。

## 本輪（文藝區）

- `commons` 的量體是 `activity-hall`。分區仍是 culture-58。精度仍是 estimated。
- 沒有新增音效。風洞與司令臺留著。

## 本輪（理工區）

- `architecture` 的量體是 `studio-block`。南向玻璃貼著牆面，屋頂採光朝南。精度仍是 estimated。
- `wind-lab` 的量體仍是 `shed`。沒有新增音效。司令臺、會議中心與覺生綜合大樓留著。

## 本輪（巡禮折線）

- 半徑 0.42 m 可以沿三條折線走到門口，也可以沿克難坡中線走上坡頂。沒有展開 132 階。
- 沒有新增音效。真機仍是 pending-device。視聽教育館、傳播館與覺生綜合大樓留著。

## 本輪（教學區）

- `business-o` 與 `business-q` 的量體是 `media-hall`。天線不是實測。
- 沒有新增音效。麗澤、風洞、司令臺與文學館留著。

## 本輪（生活區）

- `reitaku` 的量體是 `intl-dorm`。精度仍是 estimated。
- 沒有新增音效。風洞、司令臺、會議中心與覺生綜合大樓留著。

## 本輪（運動區）

- `reviewing` 的量體是 `stand`。台面還不能走上去。精度仍是 estimated。
- 沒有新增音效。會議中心與覺生綜合大樓留著。

## 本輪（文藝區）

- `audiovisual` 的量體是 `auditorium`。舞台塔不是實測。
- 沒有新增音效。文學館仍是坡頂。傳播館留著。

## 本輪（文藝區）

- `conference` 的量體是 `forum-hall`。精度仍是 estimated。
- 沒有新增音效。覺生綜合大樓與雨留著。

## 本輪（書圖區）

- `integrated` 的量體是 `linked-hall`。上層窗帶跟著退縮的牆面。精度仍是 estimated。
- 沒有新增音效。雨與手機圖示留著。

## 本輪（雨）

- 高畫質 320 條，低畫質 64 條。室內不畫。減少動態時停住，包含場景開著時改設定。
- 沒有新增音效。真機仍是 pending-device。手機圖示與路線重測留著。

## 本輪（手機圖示）

- 窄螢幕工具鈕從 36px 改成 44px，快捷圖示從 18px 改成 24px。
- 觸控窄螢幕的快捷鈕不再縮到 38px。沒有新增音效。路線重測與遠景留著。

## 本輪（路線重測）

- 靜態頁、遊戲程式 `7507c59`。標題 1.20 M、戶外 1.56 M、戰鬥 1.50 M、室內 46.5 k、返回 1.44 M。
- 幀時間仍是 SwiftShader。沒有把舊基線的數字抄進來。沒有新增音效。

## 本輪（遠景）

- 近岸碰撞把人停在河的這一側。對岸街廓改成一個實例繪製。
- 山形與河寬仍是 estimated。沒有新增音效。金幣與標示用字留著。

## 本輪（金幣與蓄力刃）

- 金幣終點沿圓周錯開。普攻蓄力幀的刃在身前。
- 沒有新增音效。標示用字與商管大樓基座留著。

## 本輪（標示用字）

- 「麗先」改為「騮先紀念科學館」；「游泳館」改為「紹謨紀念游泳館」。
- 座標仍是 estimated。沒有複製官方標示表，沒有新增音效。

## 本輪（商管大樓）

- `business-building` 從 `slab-block` 改成 `study-block`。精度仍是 estimated。
- 定步近景看得到深色基座和淺色上層。沒有新增音效。

## 本輪（門口步道）

- 41 個校園門口的步道改走到路網上能站的點。視聽教育館與正門不再穿進量體。
- 精度仍是 estimated。沒有新的階數，也不宣稱不被花木卡住。
- 狀態卡短標籤、普攻光刃與清冊都已經在 `main`。ART-090 剩下技能圖示、地圖標記、受擊回饋。下一步場景是 ART-062。

## 本輪（狀態卡）

- 狀態卡可見文字是「生命 62/108」這種短標籤，畫在淺色長條上。長句只留在 aria-label。390px 寬時目標卡在狀態卡下方。
- ART-092 授權音效還沒做。

## 現在的狀態

- 分支：`cursor/tamkang-art-pipeline-1a71`（自 `main` @ `71f4d3c`）。沒有合併 main，沒有更新公開網站。
- 管線可用：`art/` 來源 → `npm run art:export` → `public/game-art/*.glb` + manifest → `src/game/art/` 載入。
- 主遊戲已使用：主角（高畫質 `char.student-kit`、省電 `char.student-kit-lod1`）、五名清冊 NPC（`char.npc-kit`，失敗時退回 `Student`）、四種怪物（`creature.quiz/report/exam/final`，失敗時退回舊外形）、工程技能（`StructuralPulse`）。
- 九學院技能都有專屬特效，施放時改播對應的 `skill-<discipline>`（工程仍是全身 `skill`）。清冊已重產且與基準筆數一致，精度仍全部 `estimated`。宮燈教室、圖書館、體育館三類室內可進出。環境道具組、UI、音效未開始。

## 開發與驗證

```sh
npm ci
npm run dev:site                      # :8088
npm run typecheck && npm test
npm run art:validate -- --rebuild
npm run build:site
```

截圖（需 dev 或 preview 伺服器）：

```sh
node scripts/art/capture-art.mjs http://127.0.0.1:8088/ /tmp/out creature --enemy report-1 --tier high
node scripts/art/capture-art.mjs http://127.0.0.1:8088/ /tmp/out npcs --tier high
node scripts/art/capture-art.mjs http://127.0.0.1:8088/ /tmp/out turnaround --tier high --width 800 --height 800
node scripts/art/capture-route.mjs http://127.0.0.1:8089/ /tmp/route --tier low --label after-low
```

`?qa=1` 提供：`window.__rpgQA`（store、`freeze`／`step`／`resume` 定步時鐘）、
`window.__controlsTest.setPhoto`（環繞玩家的攝影機）、`window.__characterTest.play`（播放動作片段）。只用於截圖與驗收。

## 設計決策（要延續的）

1. 來源是程式（TypeScript + spec），輸出是 GLB；遊戲只載入輸出，載入失敗會顯示訊息並改用舊外形。
2. 一件角色／怪物 = 一個蒙皮網格 + 一個材質 + 一張 512² atlas（臉、布料、細節都在 atlas）。
3. 動畫與特效只讀真實狀態（`attackFx`、`hurtUntil`、敵人 `state/timer/hurt/hp`），不寫回戰鬥。
4. 預警圖形 = 真實判定形狀與半徑（目前敵人判定是圓）。
5. 步幅以 FK 量測支撐腳速度決定，不靠目測。

## 風險與注意

- 本主機無 GPU，效能數字只能同主機比較；所有裝置目標 `pending-device`。
- 主角 LOD0 曾讓省電畫質 frame time 上升；LOD1 已讓省電畫質回到基準（STATUS.md）。NPC 套用角色組時人群一律用 LOD1 等級。
- 高畫質宮燈大道的詳細樹冠改在 48 m 外換成便宜樹冠，同一站 1.56 M，低於 1.6 M（ART-102）。其他路段沒有重測。
- 匯出結果依 Node 22 + three r185 重現；升級 three 後需重新匯出並跑 `--rebuild`。
