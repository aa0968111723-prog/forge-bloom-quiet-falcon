# 美術基準盤點（Baseline）

盤點日期：2026-11-11（UTC 10:07 起）。本文件只記錄本次在本機實際執行或讀取到的結果；
歷史測試結果（例如 `docs/ART-DIRECTION.md`、`docs/SOURCE-SYNC.md` 中的通過紀錄）不當作本次通過證據。

## 1. 儲存庫狀態

| 項目 | 實測值 |
| --- | --- |
| remote | `origin` → `github.com/aa0968111723-prog/forge-bloom-quiet-falcon`（與指定儲存庫一致） |
| 起點分支／HEAD | `main` @ `71f4d3c4742fab66b0d82edff38c7e6c39497f67`（"Implement jade campus fantasy art direction"） |
| 工作分支 | `cursor/tamkang-art-pipeline-1a71`（自 `71f4d3c` 建立） |
| 起始工作區 | 乾淨：無未提交修改、無 stash；忽略目錄只有 `node_modules/`、`.output/`、`work/` |
| 其他遠端分支 | `backup/pre-sites-rpg-sync-20261111`、`claude/tamkang-reality-campus-v1-2bxs0g`（未改動） |
| 任務包 | `cursor-art-task/` 不存在；`AGENTS.md`（被 .gitignore 排除）與 `.cursor/rules` 也不存在。依指令自行建立 `docs/art/` 結構續作 |
| Git LFS | `git-lfs 3.8.0` 已安裝，但儲存庫沒有 `.gitattributes`，未啟用 LFS |

最近提交脈絡：`13e3fd4` 從 Sites 版本 3 同步 RPG 原始碼（340 檔）；`71f4d3c` 第一輪「玉綠校園奇幻」程序化美術。

## 2. 主機與工具（實測）

參考電腦 ASUS FX506HM（i7-11800H、24GB、RTX 3060）**不是**本次量測主機，以下才是實際主機：

| 項目 | 實測值 |
| --- | --- |
| 主機 | KVM 虛擬機，Ubuntu 24.04.5，4 vCPU Intel Xeon（family 6 model 207），約 15 GiB RAM（含 hypervisor balloon） |
| GPU | 無（無 `/dev/dri`、無 `nvidia-smi`） |
| 瀏覽器 WebGL | Chrome 156.0.8078.47 headless：`WebGL 2.0`，renderer `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`——**軟體算繪** |
| Node／套件管理 | Node 22.23.4、npm 10.9.9（專案使用 `package-lock.json`）；pnpm 10.33.4、yarn 1.22.22 存在但未使用 |
| Node TypeScript | Node 22 原生 type stripping 可直接 `import` `.ts`（既有測試即如此執行） |
| Playwright | 1.62.1；無內建瀏覽器，改用系統 Chrome（`/usr/bin/google-chrome-stable`） |
| 影像／影音 | ffmpeg 6.1.1 可用；ImageMagick **缺**；Python 3.12.3 可用 |
| 3D DCC | Blender **缺**；gltf-transform、gltfpack、toktx、basisu **缺** |
| 主要套件 | three 0.185.1、@react-three/fiber 9.7.0、@react-three/drei 10.7.8、react 19.2.8、vite 8.2.1、zustand 5.0.15、yuka 0.7.8、typescript 5.9.3 |

影響：
- 沒有 GPU，所有 frame time 都是 SwiftShader 數值，只能作同主機前後比較，**不能**代表手機或桌面 GPU；
  手機省電與桌面高畫質目標一律維持 `pending-device`。
- 沒有 Blender：模型來源採「可編輯程序化來源（TypeScript + 參數）→ Node 匯出 GLB」；GLB 可再匯入 Blender 編修。

## 3. 現有美術與資料入口

| 範疇 | 實際入口 | 現況 |
| --- | --- | --- |
| 學生角色 | `src/game/character/rig.ts`、`clips.ts`、`model.ts`、`dressing.ts`、`useCharacterAnimation.ts`、`src/game/Student.tsx` | 程式建立的 15 骨骼蒙皮角色；7 個網格（身體 + 頭/臉/髮/外套/背包）；只有 idle/walk/run 片段，攻擊與閃避是疊加在骨頭上的程式旋轉；沒有受擊、互動姿勢 |
| 程序化工具 | `src/game/art/sculpt.ts`、`motion.ts` | 以頂點色合併基本體；reduced-motion 偵測 |
| 怪物 | `src/game/rpg/art/creatures.ts`、`Monster.tsx` | quiz/report/exam/final 四種程序化外形；只有浮動、受擊閃白與 windup 地環；沒有出手、擊倒動畫 |
| 技能特效 | `src/game/rpg/art/SkillEffects.tsx` | 九學院映射到五種幾何家族（lattice/script/leaves/orbits/coins），命中後依時間淡出；不分預備／出手／命中／消散 |
| 宮燈教室／大道 | `src/game/landmarks/PalaceClassrooms.tsx`、`LanternAvenue.tsx`、`src/game/world/CampusCraft.tsx` | 十棟碧瓦紅牆建物、迴廊柱、窗格、宮燈；可行走 |
| 其他地標 | `src/game/landmarks/*`（克難坡、驚聲廣場、海豚、書卷、圖書館） | 程序化 |
| 世界與光影 | `src/game/world/*`（Terrain、Paths、Vegetation、Props、Sky、Water、Lighting、StylizePass、PostFx） | toon 分層＋rim 光、五種時段預設 |
| 材質庫 | `src/game/materials/*` + `public/materials/tamkang/`（20 組、67 張 PNG、`manifest.json`） | 由 `scripts/gen-materials.mjs` 產生；runtime 以 `useTexture` 載入 |
| 外部模型 | `public/models/vendor/`（Quaternius 樹木 GLB、KayKit 街道小物 glTF） | CC0，見 `ATTRIBUTION.md`；載入失敗無回退 |
| 未使用素材 | `public/textures/*.jpg`（4 張，1.2 MB） | 程式中沒有任何引用 |
| 音效 | `src/game/audio.ts` | 全部 WebAudio 合成，無音檔 |
| 室內 | `src/game/rpg/AdventureWorld.tsx`（`Interior`）、`InteriorDetails.tsx` | 共用 20×16 m 盒狀房間＋主題家具 |
| 校園清冊 | `src/game/world-data/registry/index.ts` | 見第 6 節 |
| RPG 真實戰鬥狀態 | `src/game/rpg/store.ts`（`useRpg`、`attack`、`dodge`、`tickRpg`、`hitEnemy`） | 唯一權威；semester 模組是測試用平行模擬，未接線 |

## 4. 可執行命令（本次確認）

| 命令 | 用途 | 本次結果 |
| --- | --- | --- |
| `npm ci` | 安裝依賴 | 通過（兩次，冪等） |
| `npm run typecheck` | TypeScript | 通過（9.2 s） |
| `npm test` | 16 個 node:test 檔 | **206 通過 / 0 失敗**（2.6 s） |
| `npm run build:site` | 靜態遊戲建置（`dist/`） | 通過；仍有 >500 kB chunk 提示（`AdventureApp` 555 kB、`three` 749 kB） |
| `npm run dev:site` | 靜態開發伺服器 :8088 | 可啟動，HTTP 200 |
| `npx vite preview --config vite.static.config.ts --port 8089` | 產物預覽（量測用，避免與 dev:site 搶 8088） | HTTP 200 |
| `npx eslint .` | Lint | **6 個既有錯誤**（`AdventureHud.tsx`、`prompts.ts`、`rules.ts`×3、`semester/track.ts`）＋ 12 警告；另外 `npm test` 產生的 `work/test-runtime/runtime.mjs` 未被忽略，會再多 15 個錯誤 |
| `git diff --check` | 空白檢查 | 通過 |

`dist/` 8.3 MB、103 檔。資料庫 migration 不屬於靜態美術驗收。

## 5. 畫面與效能基準（改造前，同主機）

腳本：`scripts/art/capture-route.mjs`（本次新增）。對 `vite preview` 產物執行首頁 → 戶外 → 戰鬥 → 室內 → 返回戶外，
每段實際取樣 4 秒 requestAnimationFrame 間隔、讀取 `renderer.info`，並記錄網路傳輸。
原始資料：`docs/art/evidence/baseline/baseline-high.json`、`baseline-low.json`。

| 段落 | 高畫質 1280×720：median / P95（ms） | draw calls / 三角形 | 省電 844×390：median / P95（ms） | draw calls / 三角形 |
| --- | --- | --- | --- | --- |
| 首頁 title | 3816 / 3833 | 515 / 1.91 M | 633 / 700 | 395 / 374 k |
| 戶外（宮燈大道） | 3958 / 4067 | 508 / **2.74 M** | 675 / 733 | 339 / 352 k |
| 戰鬥（突擊小考） | 4158 / 4317 | 506 / 2.75 M | 683 / 750 | 341 / 343 k |
| 室內（宮燈教室） | 183 / 217 | 23 / 28.5 k | 33.3 / 50 | 16 / 15.5 k |
| 返回戶外 | 3658 / 3817 | 363 / 2.74 M | 483 / 583 | 214 / 339 k |

| 載入與傳輸 | 高畫質 | 省電 |
| --- | --- | --- |
| 開頁到標題按鈕可見 | 38.3 s | 6.4 s |
| 標題場景穩定（幾何不再增加） | 105.7 s | 13.2 s |
| 傳輸量／資源數 | 4.63 MB／89（PNG 70 張 3.76 MB） | 1.54 MB／49 |
| JS heap | 130.5 MB | 113.9 MB |

判讀：
- 這是 SwiftShader 軟體算繪，數字只用來和本主機後續結果比較；手機與 RTX 3060 目標仍為 `pending-device`。
- 高畫質戶外三角形 2.74 M，已超過既有 `reality-regression.mjs` 的 1.6 M 預算；這是改造前就存在的問題。
- 高畫質下每幀約 4 秒，遊戲時鐘因 `delta` 上限 0.08 s 而變慢，戰鬥段只推進約 0.16 s 遊戲時間；省電段才能看到實際交戰。

畫面基準（`docs/art/evidence/baseline/`）：
- `baseline-high-2-outdoor.jpg`：主角背面、宮燈大道、碧瓦紅牆與宮燈。
- `baseline-high-3-combat.jpg`：突擊小考為單張紙片外形，尺寸偏小、正面難辨。
- `baseline-high-4-indoor.jpg`：宮燈教室室內為共用盒狀教室。
- `baseline-high-1-title.jpg`：標題鏡頭被一大塊米色幾何遮住右半畫面（待查）。

## 6. 校園清冊基準（程式即時產生）

`CAMPUS_REGISTRY`（`src/game/world-data/registry/index.ts`）在模組載入時組合，本次直接以 Node 匯入統計：

| 項目 | 數量 |
| --- | --- |
| 總紀錄 | 64 |
| `aliasOf` 別名 | 4（`chingsheng-building`、`business-building`、`gymnasium`、`maritime-museum`） |
| 非別名 | 60（不等於 60 棟已查證建築） |
| `saveKey: true` | 48（41 校園點 + 7 巡禮地標） |
| `activeInScene` | 54 |
| kind | campus-site 41、pilgrimage 7、alias 4、homonym 8、omission 4 |
| 分區 | axis-54：11、library-55：6、stem-56：11、teaching-57：11、culture-58：9、sports-59：9、life-60：7 |
| accuracy | 全部 `estimated`；沒有 `surveyed` |

另有兩套分區：七區 `ZONE_BOUNDS`（清冊）與 Reality Pass 串流用 `ZONES`（kenan、plaza、avenue…），id 不同，不可混用。

## 7. 已知限制與待測項目

- 無 GPU：真機 FPS、熱降頻、手機觸控手感 → `pending-device`。
- 高畫質戶外三角形超出既有預算；高畫質在本主機無法互動式遊玩，美術檢查以省電畫質和固定姿勢截圖為主。
- HUD 狀態卡顯示「生命 目前值 100 最大值 100 變化 目前 0 最大 0」的純文字讀數（UI 階段處理）。
- 標題畫面鏡頭前有大塊遮擋幾何。
- `semester/`、`growth/cast.ts` 的階段資料未接到即時戰鬥；技能特效不得另建狀態機，需讀 `useRpg`。
- 即時戰鬥判定是瞬間完成（`attack()` 同一幀扣血），沒有延遲命中；技能「預備」只能表現冷卻與專注就緒，不能延後判定。
- `public/textures/*.jpg` 未被使用；`vendor.tsx` 載入失敗沒有回退。
- `README.md` 提到的 `npm run gen:materials` 不在 `package.json`。
- Lint 既有錯誤 6 個；`work/` 產物未列入 ESLint ignore。
