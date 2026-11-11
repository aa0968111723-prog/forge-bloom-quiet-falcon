# 交接

最後更新：2026-11-11。科學館與泳館的標示改成秘書處用字。商管大樓仍是教學樓基座。整體目標尚未完成。
恢復工作時先讀 `CHECKPOINT.json` 的 `next_action`，再看 `BACKLOG.json` 的依賴。

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
